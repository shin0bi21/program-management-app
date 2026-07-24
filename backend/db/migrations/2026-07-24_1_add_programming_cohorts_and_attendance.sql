ALTER TABLE programs
    ADD COLUMN description TEXT;

INSERT INTO programs (name)
VALUES ('Drop In')
ON CONFLICT (name) DO NOTHING;

CREATE TABLE program_cohorts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    program_id UUID NOT NULL REFERENCES programs(id) ON DELETE RESTRICT,
    name VARCHAR(120) NOT NULL,
    starts_on DATE NOT NULL,
    ends_on DATE NOT NULL,
    LIKE base_table INCLUDING ALL,
    CHECK (LENGTH(BTRIM(name)) > 0),
    CHECK (ends_on >= starts_on),
    UNIQUE (program_id, name)
);

CREATE INDEX idx_program_cohorts_program_id ON program_cohorts(program_id);
CREATE INDEX idx_program_cohorts_dates ON program_cohorts(starts_on, ends_on);

CREATE TABLE cohort_enrollments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    cohort_id UUID NOT NULL REFERENCES program_cohorts(id) ON DELETE RESTRICT,
    youth_id UUID NOT NULL REFERENCES youth_profiles(user_id) ON DELETE RESTRICT,
    enrolled_on DATE NOT NULL DEFAULT ((CURRENT_TIMESTAMP AT TIME ZONE 'America/Toronto')::date),
    withdrawn_on DATE,
    LIKE base_table INCLUDING ALL,
    CHECK (withdrawn_on IS NULL OR withdrawn_on >= enrolled_on),
    UNIQUE (cohort_id, youth_id)
);

CREATE INDEX idx_cohort_enrollments_cohort_id ON cohort_enrollments(cohort_id);
CREATE INDEX idx_cohort_enrollments_youth_id ON cohort_enrollments(youth_id);

CREATE TABLE cohort_activities (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    cohort_id UUID NOT NULL REFERENCES program_cohorts(id) ON DELETE CASCADE,
    name VARCHAR(120) NOT NULL,
    description TEXT,
    LIKE base_table INCLUDING ALL,
    CHECK (LENGTH(BTRIM(name)) > 0),
    UNIQUE (cohort_id, name)
);

CREATE INDEX idx_cohort_activities_cohort_id ON cohort_activities(cohort_id);

CREATE TABLE cohort_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    activity_id UUID NOT NULL REFERENCES cohort_activities(id) ON DELETE CASCADE,
    focus VARCHAR(160),
    starts_at TIMESTAMPTZ NOT NULL,
    ends_at TIMESTAMPTZ NOT NULL,
    cancelled_at TIMESTAMPTZ,
    notes TEXT,
    LIKE base_table INCLUDING ALL,
    CHECK (focus IS NULL OR LENGTH(BTRIM(focus)) > 0),
    CHECK (ends_at > starts_at),
    UNIQUE (activity_id, starts_at)
);

CREATE INDEX idx_cohort_sessions_activity_id ON cohort_sessions(activity_id);
CREATE INDEX idx_cohort_sessions_starts_at ON cohort_sessions(starts_at);

CREATE TYPE attendance_status AS ENUM ('present', 'absent', 'late', 'excused');

CREATE TABLE attendance_records (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID NOT NULL REFERENCES cohort_sessions(id) ON DELETE RESTRICT,
    youth_id UUID NOT NULL REFERENCES youth_profiles(user_id) ON DELETE RESTRICT,
    status attendance_status NOT NULL,
    notes TEXT,
    marked_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    marked_by UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (session_id, youth_id)
);

CREATE INDEX idx_attendance_records_session_id ON attendance_records(session_id);
CREATE INDEX idx_attendance_records_youth_id ON attendance_records(youth_id);

ALTER TABLE program_cohorts
    ADD CONSTRAINT fk_program_cohorts_created_by FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL,
    ADD CONSTRAINT fk_program_cohorts_updated_by FOREIGN KEY (updated_by) REFERENCES users(id) ON DELETE SET NULL;

ALTER TABLE cohort_enrollments
    ADD CONSTRAINT fk_cohort_enrollments_created_by FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL,
    ADD CONSTRAINT fk_cohort_enrollments_updated_by FOREIGN KEY (updated_by) REFERENCES users(id) ON DELETE SET NULL;

ALTER TABLE cohort_activities
    ADD CONSTRAINT fk_cohort_activities_created_by FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL,
    ADD CONSTRAINT fk_cohort_activities_updated_by FOREIGN KEY (updated_by) REFERENCES users(id) ON DELETE SET NULL;

ALTER TABLE cohort_sessions
    ADD CONSTRAINT fk_cohort_sessions_created_by FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL,
    ADD CONSTRAINT fk_cohort_sessions_updated_by FOREIGN KEY (updated_by) REFERENCES users(id) ON DELETE SET NULL;

CREATE OR REPLACE FUNCTION enforce_session_within_cohort_dates()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
    cohort_starts_on DATE;
    cohort_ends_on DATE;
BEGIN
    SELECT pc.starts_on, pc.ends_on
    INTO cohort_starts_on, cohort_ends_on
    FROM cohort_activities ca
    INNER JOIN program_cohorts pc ON pc.id = ca.cohort_id
    WHERE ca.id = NEW.activity_id;

    IF (NEW.starts_at AT TIME ZONE 'America/Toronto')::date < cohort_starts_on
       OR (NEW.ends_at AT TIME ZONE 'America/Toronto')::date > cohort_ends_on THEN
        RAISE EXCEPTION 'Session must fall within its cohort date range'
            USING ERRCODE = '23514';
    END IF;

    RETURN NEW;
END;
$$;

CREATE TRIGGER cohort_sessions_within_cohort_dates
BEFORE INSERT OR UPDATE OF activity_id, starts_at, ends_at
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
        FROM cohort_activities ca
        INNER JOIN cohort_sessions cs ON cs.activity_id = ca.id
        WHERE ca.cohort_id = NEW.id
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

CREATE TRIGGER program_cohort_dates_contain_sessions
BEFORE UPDATE OF starts_on, ends_on
ON program_cohorts
FOR EACH ROW
EXECUTE FUNCTION enforce_cohort_dates_contain_sessions();

INSERT INTO user_permissions (name)
VALUES
    ('read:cohorts'),
    ('write:cohorts'),
    ('read:attendance'),
    ('write:attendance')
ON CONFLICT (name) DO NOTHING;

INSERT INTO user_role_has_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM user_roles r, user_permissions p
WHERE r.name IN ('admin', 'staff')
  AND p.name IN ('read:cohorts', 'write:cohorts', 'read:attendance', 'write:attendance')
ON CONFLICT DO NOTHING;
