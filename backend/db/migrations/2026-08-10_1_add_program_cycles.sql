CREATE TABLE program_cycles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(120) NOT NULL UNIQUE,
  starts_on DATE NOT NULL,
  ends_on DATE NOT NULL,
  LIKE base_table INCLUDING ALL,
  CHECK (LENGTH(BTRIM(name)) > 0),
  CHECK (ends_on >= starts_on)
);

ALTER TABLE program_cycles
  ADD CONSTRAINT fk_program_cycles_created_by FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL,
  ADD CONSTRAINT fk_program_cycles_updated_by FOREIGN KEY (updated_by) REFERENCES users(id) ON DELETE SET NULL;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM program_cohorts
    GROUP BY name
    HAVING COUNT(DISTINCT (starts_on, ends_on)) > 1
  ) THEN
    RAISE EXCEPTION 'A cohort name maps to multiple date ranges; resolve it before adding program cycles';
  END IF;
END;
$$;

INSERT INTO program_cycles (name, starts_on, ends_on, created_by, updated_by)
SELECT name, MIN(starts_on), MIN(ends_on), MIN(created_by::text)::uuid, MIN(updated_by::text)::uuid
FROM program_cohorts
GROUP BY name;

ALTER TABLE program_cohorts ADD COLUMN cycle_id UUID;

UPDATE program_cohorts cohort
SET cycle_id = cycle.id
FROM program_cycles cycle
WHERE cycle.name = cohort.name
  AND cycle.starts_on = cohort.starts_on
  AND cycle.ends_on = cohort.ends_on;

ALTER TABLE program_cohorts
  ALTER COLUMN cycle_id SET NOT NULL,
  ADD CONSTRAINT fk_program_cohorts_cycle FOREIGN KEY (cycle_id) REFERENCES program_cycles(id) ON DELETE RESTRICT,
  ADD CONSTRAINT uq_program_cohorts_program_cycle UNIQUE (program_id, cycle_id);

DROP TRIGGER program_cohort_dates_contain_sessions ON program_cohorts;
DROP FUNCTION enforce_cohort_dates_contain_sessions();

CREATE OR REPLACE FUNCTION enforce_session_within_cohort_dates()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  cycle_starts_on DATE;
  cycle_ends_on DATE;
BEGIN
  SELECT cycle.starts_on, cycle.ends_on
  INTO cycle_starts_on, cycle_ends_on
  FROM program_cohorts cohort
  INNER JOIN program_cycles cycle ON cycle.id = cohort.cycle_id
  WHERE cohort.id = NEW.cohort_id;

  IF (NEW.starts_at AT TIME ZONE 'America/Toronto')::date < cycle_starts_on
     OR (NEW.ends_at AT TIME ZONE 'America/Toronto')::date > cycle_ends_on THEN
    RAISE EXCEPTION 'Session must fall within its cohort cycle date range'
      USING ERRCODE = '23514';
  END IF;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION enforce_cycle_dates_contain_sessions()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM program_cohorts cohort
    INNER JOIN cohort_sessions session ON session.cohort_id = cohort.id
    WHERE cohort.cycle_id = NEW.id
      AND (
        (session.starts_at AT TIME ZONE 'America/Toronto')::date < NEW.starts_on
        OR (session.ends_at AT TIME ZONE 'America/Toronto')::date > NEW.ends_on
      )
  ) THEN
    RAISE EXCEPTION 'Cycle dates must contain all existing sessions'
      USING ERRCODE = '23514';
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER program_cycle_dates_contain_sessions
BEFORE UPDATE OF starts_on, ends_on
ON program_cycles
FOR EACH ROW
EXECUTE FUNCTION enforce_cycle_dates_contain_sessions();

CREATE OR REPLACE FUNCTION enforce_cohort_cycle_contains_sessions()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM cohort_sessions session
    INNER JOIN program_cycles cycle ON cycle.id = NEW.cycle_id
    WHERE session.cohort_id = NEW.id
      AND (
        (session.starts_at AT TIME ZONE 'America/Toronto')::date < cycle.starts_on
        OR (session.ends_at AT TIME ZONE 'America/Toronto')::date > cycle.ends_on
      )
  ) THEN
    RAISE EXCEPTION 'Cohort cycle must contain all existing sessions'
      USING ERRCODE = '23514';
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER program_cohort_cycle_contains_sessions
BEFORE UPDATE OF cycle_id
ON program_cohorts
FOR EACH ROW
EXECUTE FUNCTION enforce_cohort_cycle_contains_sessions();

ALTER TABLE program_cohorts
  DROP CONSTRAINT program_cohorts_program_id_name_key,
  DROP CONSTRAINT program_cohorts_name_check,
  DROP CONSTRAINT program_cohorts_check,
  DROP COLUMN name,
  DROP COLUMN starts_on,
  DROP COLUMN ends_on;

DROP INDEX IF EXISTS idx_program_cohorts_dates;
CREATE INDEX idx_program_cohorts_cycle_id ON program_cohorts(cycle_id);
CREATE INDEX idx_program_cycles_dates ON program_cycles(starts_on, ends_on);
