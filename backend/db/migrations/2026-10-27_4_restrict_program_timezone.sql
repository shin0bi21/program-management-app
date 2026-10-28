CREATE TYPE program_timezone AS ENUM ('America/Toronto');

ALTER TABLE programs
  DROP CONSTRAINT programs_timezone_check,
  ALTER COLUMN timezone DROP DEFAULT,
  ALTER COLUMN timezone TYPE program_timezone USING timezone::program_timezone,
  ALTER COLUMN timezone SET DEFAULT 'America/Toronto'::program_timezone;

CREATE OR REPLACE FUNCTION enforce_session_within_cohort_dates()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  cycle_starts_on DATE;
  cycle_ends_on DATE;
  program_timezone TEXT;
BEGIN
  SELECT cycle.starts_on, cycle.ends_on, program.timezone::text
  INTO cycle_starts_on, cycle_ends_on, program_timezone
  FROM program_cohorts cohort
  INNER JOIN program_cycles cycle ON cycle.id = cohort.cycle_id
  INNER JOIN programs program ON program.id = cohort.program_id
  WHERE cohort.id = NEW.cohort_id;

  IF (NEW.starts_at AT TIME ZONE program_timezone)::date < cycle_starts_on
     OR (NEW.ends_at AT TIME ZONE program_timezone)::date > cycle_ends_on THEN
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
    INNER JOIN programs program ON program.id = cohort.program_id
    WHERE cohort.cycle_id = NEW.id
      AND (
        (session.starts_at AT TIME ZONE program.timezone::text)::date < NEW.starts_on
        OR (session.ends_at AT TIME ZONE program.timezone::text)::date > NEW.ends_on
      )
  ) THEN
    RAISE EXCEPTION 'Cycle dates must contain all existing sessions'
      USING ERRCODE = '23514';
  END IF;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION enforce_cohort_cycle_contains_sessions()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM cohort_sessions session
    INNER JOIN program_cycles cycle ON cycle.id = NEW.cycle_id
    INNER JOIN programs program ON program.id = NEW.program_id
    WHERE session.cohort_id = NEW.id
      AND (
        (session.starts_at AT TIME ZONE program.timezone::text)::date < cycle.starts_on
        OR (session.ends_at AT TIME ZONE program.timezone::text)::date > cycle.ends_on
      )
  ) THEN
    RAISE EXCEPTION 'Cohort cycle must contain all existing sessions'
      USING ERRCODE = '23514';
  END IF;

  RETURN NEW;
END;
$$;

