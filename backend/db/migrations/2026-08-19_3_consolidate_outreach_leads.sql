-- Consolidate public expressions of interest and staff-created prospects into
-- one canonical leads workflow. The expressions table is intentionally kept
-- for one deployment as a frozen reconciliation source; a later migration may
-- remove it only after production counts and public intake have been verified.

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM expressions_of_interest expression
    LEFT JOIN leads lead ON lead.expression_of_interest_id = expression.id
    WHERE expression.status IN ('converted', 'signed_up')
      AND lead.id IS NULL
  ) THEN
    RAISE EXCEPTION 'Cannot consolidate outreach: a converted or signed-up expression has no linked lead';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM expressions_of_interest expression
    INNER JOIN leads lead ON lead.expression_of_interest_id = expression.id
    WHERE expression.status = 'signed_up'
      AND (lead.status <> 'signed_up' OR lead.converted_youth_id IS NULL)
  ) THEN
    RAISE EXCEPTION 'Cannot consolidate outreach: a signed-up expression does not have a signed-up linked lead';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM expressions_of_interest expression
    LEFT JOIN leads linked ON linked.expression_of_interest_id = expression.id
    INNER JOIN leads collision ON collision.id = expression.id
    WHERE linked.id IS NULL
  ) THEN
    RAISE EXCEPTION 'Cannot consolidate outreach: an unconverted expression UUID collides with an existing lead UUID';
  END IF;
END;
$$;

ALTER TYPE lead_origin RENAME VALUE 'expression_of_interest' TO 'external';
ALTER TYPE lead_origin RENAME VALUE 'staff_created' TO 'internal';

CREATE TYPE lead_submitter_role AS ENUM ('youth', 'parent', 'guardian', 'staff');

DO $$
DECLARE
  constraint_name TEXT;
BEGIN
  SELECT catalog_constraint.conname INTO constraint_name
  FROM pg_constraint catalog_constraint
  WHERE catalog_constraint.conrelid = 'leads'::regclass
    AND catalog_constraint.contype = 'c'
    AND pg_get_constraintdef(catalog_constraint.oid) LIKE '%origin%expression_of_interest_id%';

  IF constraint_name IS NULL THEN
    RAISE EXCEPTION 'Cannot consolidate outreach: the existing lead origin/source constraint was not found';
  END IF;
  EXECUTE format('ALTER TABLE leads DROP CONSTRAINT %I', constraint_name);
END;
$$;

ALTER TABLE leads
  ADD COLUMN submitted_by_role lead_submitter_role NOT NULL DEFAULT 'staff';

CREATE INDEX idx_leads_origin_created_at ON leads(origin, created_at DESC);

-- A linked lead is already authoritative. Preserve all operational lead data,
-- but use the original public submission time as its funnel-entry timestamp.
UPDATE leads lead
SET created_at = LEAST(lead.created_at, expression.created_at),
    submitted_by_role = expression.submitted_by_role::text::lead_submitter_role
FROM expressions_of_interest expression
WHERE lead.expression_of_interest_id = expression.id;

DO $$
DECLARE
  expected_count INTEGER;
  inserted_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO expected_count
  FROM expressions_of_interest expression
  LEFT JOIN leads lead ON lead.expression_of_interest_id = expression.id
  WHERE lead.id IS NULL
    AND expression.status <> 'spam';

  INSERT INTO leads (
    id,
    origin,
    expression_of_interest_id,
    submitted_by_role,
    youth_first_name,
    youth_last_name,
    age,
    school,
    program_of_interest_id,
    contact_phone_number,
    contact_relationship,
    discovery_source,
    notes,
    status,
    status_updated_at,
    created_at,
    updated_at,
    created_by,
    updated_by
  )
  SELECT
    expression.id,
    'external'::lead_origin,
    expression.id,
    expression.submitted_by_role::text::lead_submitter_role,
    expression.youth_first_name,
    expression.youth_last_name,
    expression.age,
    expression.school,
    NULL,
    expression.contact_phone_number,
    expression.contact_relationship,
    expression.discovery_source,
    expression.notes,
    CASE expression.status
      WHEN 'contacted' THEN 'contacted'::lead_status
      ELSE 'new'::lead_status
    END,
    expression.status_updated_at,
    expression.created_at,
    expression.updated_at,
    expression.created_by,
    expression.updated_by
  FROM expressions_of_interest expression
  LEFT JOIN leads lead ON lead.expression_of_interest_id = expression.id
  WHERE lead.id IS NULL
    AND expression.status <> 'spam';

  GET DIAGNOSTICS inserted_count = ROW_COUNT;
  IF inserted_count <> expected_count THEN
    RAISE EXCEPTION 'Outreach reconciliation mismatch: expected % new external leads, inserted %', expected_count, inserted_count;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM expressions_of_interest expression
    LEFT JOIN leads lead ON lead.expression_of_interest_id = expression.id
    WHERE expression.status <> 'spam'
      AND (lead.id IS NULL OR lead.origin <> 'external')
  ) THEN
    RAISE EXCEPTION 'Outreach reconciliation failed: not every expression maps to one external lead';
  END IF;
END;
$$;

-- Add the cross-field constraint only after every legacy external lead has
-- received the submitter role from its source expression.
ALTER TABLE leads
  ADD CONSTRAINT leads_origin_source_check CHECK (
    (origin = 'external' AND submitted_by_role IN ('youth', 'parent', 'guardian'))
    OR (origin = 'internal' AND expression_of_interest_id IS NULL AND submitted_by_role = 'staff')
  );

-- The old expression-specific preference cannot be valid on the unified page.
DELETE FROM user_preferences WHERE preference_key = 'expression-interest-filters';
