CREATE TABLE project_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  LIKE base_table INCLUDING ALL,
  singleton BOOLEAN NOT NULL DEFAULT TRUE UNIQUE CHECK (singleton),
  week_start TEXT NOT NULL CHECK (week_start IN ('sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday')),
  timezone TEXT NOT NULL,
  FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL,
  FOREIGN KEY (updated_by) REFERENCES users(id) ON DELETE SET NULL
);

CREATE FUNCTION valid_project_timezone(value TEXT) RETURNS BOOLEAN
LANGUAGE SQL STABLE AS $$
  SELECT EXISTS (SELECT 1 FROM pg_timezone_names WHERE name = value);
$$;

ALTER TABLE project_settings ADD CONSTRAINT project_settings_timezone_check CHECK (valid_project_timezone(timezone));

INSERT INTO project_settings (week_start, timezone)
VALUES ('sunday', 'America/Toronto');

CREATE OR REPLACE FUNCTION enforce_session_within_cohort_dates()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  cycle_starts_on DATE;
  cycle_ends_on DATE;
  project_timezone TEXT;
BEGIN
  SELECT cycle.starts_on, cycle.ends_on, settings.timezone
  INTO cycle_starts_on, cycle_ends_on, project_timezone
  FROM program_cohorts cohort
  INNER JOIN program_cycles cycle ON cycle.id = cohort.cycle_id
  CROSS JOIN project_settings settings
  WHERE cohort.id = NEW.cohort_id
    AND settings.singleton;

  IF (NEW.starts_at AT TIME ZONE project_timezone)::date < cycle_starts_on
     OR (NEW.ends_at AT TIME ZONE project_timezone)::date > cycle_ends_on THEN
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
DECLARE
  project_timezone TEXT;
BEGIN
  SELECT timezone INTO STRICT project_timezone
  FROM project_settings WHERE singleton;

  IF EXISTS (
    SELECT 1
    FROM program_cohorts cohort
    INNER JOIN cohort_sessions session ON session.cohort_id = cohort.id
    WHERE cohort.cycle_id = NEW.id
      AND (
        (session.starts_at AT TIME ZONE project_timezone)::date < NEW.starts_on
        OR (session.ends_at AT TIME ZONE project_timezone)::date > NEW.ends_on
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
DECLARE
  project_timezone TEXT;
BEGIN
  SELECT timezone INTO STRICT project_timezone
  FROM project_settings WHERE singleton;

  IF EXISTS (
    SELECT 1
    FROM cohort_sessions session
    INNER JOIN program_cycles cycle ON cycle.id = NEW.cycle_id
    WHERE session.cohort_id = NEW.id
      AND (
        (session.starts_at AT TIME ZONE project_timezone)::date < cycle.starts_on
        OR (session.ends_at AT TIME ZONE project_timezone)::date > cycle.ends_on
      )
  ) THEN
    RAISE EXCEPTION 'Cohort cycle must contain all existing sessions'
      USING ERRCODE = '23514';
  END IF;

  RETURN NEW;
END;
$$;


CREATE OR REPLACE FUNCTION project_business_date() RETURNS DATE
LANGUAGE plpgsql STABLE AS $$
DECLARE
  project_timezone TEXT;
BEGIN
  SELECT timezone INTO STRICT project_timezone
  FROM project_settings WHERE singleton;

  RETURN (CURRENT_TIMESTAMP AT TIME ZONE project_timezone)::date;
END;
$$;

ALTER TABLE programs DROP COLUMN timezone;
DROP TYPE program_timezone;

ALTER TABLE cohort_enrollments
  ALTER COLUMN enrolled_on SET DEFAULT project_business_date();

INSERT INTO user_permissions (name) VALUES ('read:project_settings'), ('write:project_settings');

INSERT INTO user_role_has_permissions (role_id, permission_id)
SELECT role.id, permission.id
FROM user_roles role CROSS JOIN user_permissions permission
WHERE role.name = 'admin' AND permission.name IN ('read:project_settings', 'write:project_settings');
