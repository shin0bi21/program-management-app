ALTER TABLE cohort_interest_submissions
    ADD COLUMN youth_first_name VARCHAR(80),
    ADD COLUMN youth_last_name VARCHAR(80),
    ADD COLUMN contact_first_name VARCHAR(80),
    ADD COLUMN contact_last_name VARCHAR(80),
    ADD COLUMN contact_phone_number VARCHAR(30),
    ADD COLUMN contact_relationship contact_type;

UPDATE cohort_interest_submissions
SET
    youth_first_name = split_part(regexp_replace(BTRIM(youth_name), '\s+', ' ', 'g'), ' ', 1),
    youth_last_name = NULLIF(
        regexp_replace(
            regexp_replace(BTRIM(youth_name), '\s+', ' ', 'g'),
            '^\S+\s*',
            ''
        ),
        ''
    ),
    contact_first_name = CASE
        WHEN NULLIF(BTRIM(parent_name), '') IS NULL THEN NULL
        ELSE split_part(regexp_replace(BTRIM(parent_name), '\s+', ' ', 'g'), ' ', 1)
    END,
    contact_last_name = CASE
        WHEN NULLIF(BTRIM(parent_name), '') IS NULL THEN NULL
        ELSE NULLIF(
            regexp_replace(
                regexp_replace(BTRIM(parent_name), '\s+', ' ', 'g'),
                '^\S+\s*',
                ''
            ),
            ''
        )
    END,
    contact_phone_number = CASE
        WHEN NULLIF(BTRIM(parent_name), '') IS NULL THEN NULL
        ELSE phone_number
    END,
    contact_relationship = CASE
        WHEN NULLIF(BTRIM(parent_name), '') IS NULL THEN NULL
        ELSE 'parent'::contact_type
    END;

ALTER TABLE cohort_interest_submissions
    ALTER COLUMN youth_first_name SET NOT NULL,
    ALTER COLUMN youth_last_name SET NOT NULL,
    ALTER COLUMN school SET NOT NULL,
    ALTER COLUMN discovery_source SET NOT NULL,
    DROP COLUMN youth_name,
    DROP COLUMN parent_name,
    DROP CONSTRAINT cohort_interest_submissions_status_check,
    ADD CONSTRAINT cohort_interest_submissions_status_check
        CHECK (status IN ('new', 'reviewed', 'contacted', 'converted', 'signed_up', 'lost', 'spam')),
    ADD CONSTRAINT cohort_interest_submissions_youth_first_name_check
        CHECK (LENGTH(BTRIM(youth_first_name)) > 0),
    ADD CONSTRAINT cohort_interest_submissions_youth_last_name_check
        CHECK (LENGTH(BTRIM(youth_last_name)) > 0),
    ADD CONSTRAINT cohort_interest_submissions_school_check
        CHECK (LENGTH(BTRIM(school)) > 0),
    ADD CONSTRAINT cohort_interest_submissions_primary_contact_check
        CHECK (
            contact_first_name IS NOT NULL
            AND LENGTH(BTRIM(contact_first_name)) > 0
            AND contact_last_name IS NOT NULL
            AND LENGTH(BTRIM(contact_last_name)) > 0
            AND contact_phone_number IS NOT NULL
            AND LENGTH(BTRIM(contact_phone_number)) > 0
            AND contact_relationship IS NOT NULL
        ) NOT VALID;

CREATE TYPE lead_origin AS ENUM ('interest_submission', 'staff_created');
CREATE TYPE lead_status AS ENUM ('new', 'contacted', 'qualified', 'signed_up', 'lost', 'ineligible');

CREATE TABLE leads (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    origin lead_origin NOT NULL,
    interest_submission_id UUID UNIQUE REFERENCES cohort_interest_submissions(id) ON DELETE RESTRICT,
    youth_first_name VARCHAR(120) NOT NULL,
    youth_last_name VARCHAR(120) NOT NULL,
    age SMALLINT NOT NULL,
    school VARCHAR(255) NOT NULL,
    response_email VARCHAR(255),
    response_phone_number VARCHAR(40),
    contact_first_name VARCHAR(120) NOT NULL,
    contact_last_name VARCHAR(120) NOT NULL,
    contact_phone_number VARCHAR(40) NOT NULL,
    contact_relationship contact_type NOT NULL,
    discovery_source discovery_source NOT NULL,
    notes TEXT,
    status lead_status NOT NULL DEFAULT 'new',
    status_updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    LIKE base_table INCLUDING ALL,
    CHECK (LENGTH(TRIM(youth_first_name)) > 0),
    CHECK (LENGTH(TRIM(youth_last_name)) > 0),
    CHECK (age BETWEEN 5 AND 24),
    CHECK (LENGTH(TRIM(school)) > 0),
    CHECK (response_email IS NOT NULL OR response_phone_number IS NOT NULL),
    CHECK (response_email IS NULL OR response_email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$'),
    CHECK (LENGTH(TRIM(contact_first_name)) > 0),
    CHECK (LENGTH(TRIM(contact_last_name)) > 0),
    CHECK (LENGTH(TRIM(contact_phone_number)) > 0),
    CHECK (
        (origin = 'interest_submission' AND interest_submission_id IS NOT NULL)
        OR (origin = 'staff_created' AND interest_submission_id IS NULL)
    )
);

CREATE INDEX idx_leads_status ON leads(status);
CREATE INDEX idx_leads_origin ON leads(origin);
CREATE INDEX idx_leads_created_at ON leads(created_at DESC);
CREATE INDEX idx_leads_created_by ON leads(created_by);

INSERT INTO user_permissions (name)
VALUES ('read:outreach'), ('write:outreach')
ON CONFLICT (name) DO NOTHING;

INSERT INTO user_role_has_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM user_roles r, user_permissions p
WHERE r.name IN ('admin', 'staff')
  AND p.name IN ('read:outreach', 'write:outreach')
ON CONFLICT DO NOTHING;

-- Preserve legacy contact details before removing the public form's old
-- response fields. NOT VALID constraints still apply to updated rows, so the
-- required contact values must be backfilled before the email is copied.
UPDATE cohort_interest_submissions
SET
    contact_first_name = COALESCE(NULLIF(BTRIM(contact_first_name), ''), 'Unknown'),
    contact_last_name = COALESCE(NULLIF(BTRIM(contact_last_name), ''), 'Contact'),
    contact_phone_number = COALESCE(
        NULLIF(BTRIM(contact_phone_number), ''),
        NULLIF(BTRIM(phone_number), ''),
        'Not provided (see notes)'
    ),
    contact_relationship = COALESCE(contact_relationship, 'parent'::contact_type)
WHERE contact_first_name IS NULL
   OR contact_last_name IS NULL
   OR contact_phone_number IS NULL
   OR contact_relationship IS NULL;

UPDATE cohort_interest_submissions
SET message = CONCAT_WS(
    E'\n\n',
    NULLIF(BTRIM(message), ''),
    'Legacy contact email: ' || BTRIM(email)
)
WHERE NULLIF(BTRIM(email), '') IS NOT NULL;

ALTER TABLE cohort_interest_submissions
    VALIDATE CONSTRAINT cohort_interest_submissions_primary_contact_check;

ALTER TABLE cohort_interest_submissions
    ALTER COLUMN contact_first_name SET NOT NULL,
    ALTER COLUMN contact_last_name SET NOT NULL,
    ALTER COLUMN contact_phone_number SET NOT NULL,
    ALTER COLUMN contact_relationship SET NOT NULL,
    DROP COLUMN email CASCADE,
    DROP COLUMN phone_number CASCADE;

ALTER TABLE cohort_interest_submissions
    RENAME COLUMN message TO notes;

ALTER TABLE leads
    DROP COLUMN response_email CASCADE,
    DROP COLUMN response_phone_number CASCADE;

ALTER TABLE cohort_interest_submissions
    RENAME TO expressions_of_interest;

ALTER TYPE lead_origin
    RENAME VALUE 'interest_submission' TO 'expression_of_interest';

ALTER TABLE leads
    RENAME COLUMN interest_submission_id TO expression_of_interest_id;
