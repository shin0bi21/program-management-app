DROP TRIGGER cohort_sessions_within_cohort_dates ON cohort_sessions;

ALTER TABLE cohort_sessions
    ADD COLUMN cohort_id UUID REFERENCES program_cohorts(id) ON DELETE CASCADE;

ALTER TABLE cohort_sessions
    RENAME COLUMN focus TO theme;

ALTER TABLE cohort_sessions
    RENAME COLUMN notes TO description;

UPDATE cohort_sessions cs
SET cohort_id = ca.cohort_id,
    theme = COALESCE(cs.theme, ca.name),
    description = COALESCE(cs.description, ca.description)
FROM cohort_activities ca
WHERE ca.id = cs.activity_id;

ALTER TABLE cohort_sessions
    ALTER COLUMN cohort_id SET NOT NULL,
    ALTER COLUMN theme SET NOT NULL,
    DROP CONSTRAINT cohort_sessions_activity_id_fkey,
    DROP CONSTRAINT cohort_sessions_activity_id_starts_at_key,
    DROP COLUMN activity_id;

DROP INDEX IF EXISTS idx_cohort_sessions_activity_id;
CREATE INDEX idx_cohort_sessions_cohort_id ON cohort_sessions(cohort_id);
CREATE UNIQUE INDEX uq_cohort_sessions_cohort_theme_start
    ON cohort_sessions(cohort_id, theme, starts_at);

DROP TABLE cohort_activities;

CREATE OR REPLACE FUNCTION enforce_session_within_cohort_dates()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
    cohort_starts_on DATE;
    cohort_ends_on DATE;
BEGIN
    SELECT starts_on, ends_on
    INTO cohort_starts_on, cohort_ends_on
    FROM program_cohorts
    WHERE id = NEW.cohort_id;

    IF (NEW.starts_at AT TIME ZONE 'America/Toronto')::date < cohort_starts_on
       OR (NEW.ends_at AT TIME ZONE 'America/Toronto')::date > cohort_ends_on THEN
        RAISE EXCEPTION 'Session must fall within its cohort date range'
            USING ERRCODE = '23514';
    END IF;

    RETURN NEW;
END;
$$;

CREATE TRIGGER cohort_sessions_within_cohort_dates
BEFORE INSERT OR UPDATE OF cohort_id, starts_at, ends_at
ON cohort_sessions
FOR EACH ROW
EXECUTE FUNCTION enforce_session_within_cohort_dates();

CREATE OR REPLACE FUNCTION enforce_cohort_dates_contain_sessions()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM cohort_sessions cs
        WHERE cs.cohort_id = NEW.id
          AND (
            (cs.starts_at AT TIME ZONE 'America/Toronto')::date < NEW.starts_on
            OR (cs.ends_at AT TIME ZONE 'America/Toronto')::date > NEW.ends_on
          )
    ) THEN
        RAISE EXCEPTION 'Cohort dates must contain all existing sessions'
            USING ERRCODE = '23514';
    END IF;

    RETURN NEW;
END;
$$;
