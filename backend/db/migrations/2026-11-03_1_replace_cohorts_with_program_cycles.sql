-- Preserve allowed combinations and audit metadata without a surrogate assignment identity.
CREATE TABLE program_cycle_assignments (
  program_id UUID NOT NULL REFERENCES programs(id) ON DELETE RESTRICT,
  cycle_id UUID NOT NULL REFERENCES program_cycles(id) ON DELETE RESTRICT,
  LIKE base_table INCLUDING ALL,
  PRIMARY KEY (program_id, cycle_id),
  FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL,
  FOREIGN KEY (updated_by) REFERENCES users(id) ON DELETE SET NULL
);

INSERT INTO program_cycle_assignments (program_id, cycle_id, created_at, updated_at, created_by, updated_by)
SELECT program_id, cycle_id, created_at, updated_at, created_by, updated_by FROM program_cohorts;
CREATE INDEX idx_program_cycle_assignments_cycle ON program_cycle_assignments(cycle_id);

ALTER TABLE cohort_sessions RENAME TO program_sessions;
ALTER TABLE cohort_enrollments RENAME TO program_enrollments;
ALTER TABLE program_sessions ADD COLUMN program_id UUID, ADD COLUMN cycle_id UUID;
ALTER TABLE program_enrollments ADD COLUMN program_id UUID, ADD COLUMN cycle_id UUID;
UPDATE program_sessions session SET program_id = assignment.program_id, cycle_id = assignment.cycle_id
FROM program_cohorts assignment WHERE assignment.id = session.cohort_id;
UPDATE program_enrollments enrollment SET program_id = assignment.program_id, cycle_id = assignment.cycle_id
FROM program_cohorts assignment WHERE assignment.id = enrollment.cohort_id;

DROP TRIGGER cohort_sessions_within_cohort_dates ON program_sessions;
DROP TRIGGER program_cohort_cycle_contains_sessions ON program_cohorts;
DROP FUNCTION enforce_cohort_cycle_contains_sessions();
DROP INDEX uq_cohort_sessions_cohort_theme_start;
ALTER TABLE program_sessions DROP COLUMN cohort_id,
  ALTER COLUMN program_id SET NOT NULL, ALTER COLUMN cycle_id SET NOT NULL,
  ADD CONSTRAINT fk_program_sessions_assignment FOREIGN KEY (program_id, cycle_id)
    REFERENCES program_cycle_assignments(program_id, cycle_id) ON DELETE RESTRICT;
ALTER TABLE program_enrollments DROP COLUMN cohort_id,
  ALTER COLUMN program_id SET NOT NULL, ALTER COLUMN cycle_id SET NOT NULL,
  ADD CONSTRAINT fk_program_enrollments_assignment FOREIGN KEY (program_id, cycle_id)
    REFERENCES program_cycle_assignments(program_id, cycle_id) ON DELETE RESTRICT,
  ADD CONSTRAINT uq_program_enrollments_program_cycle_youth UNIQUE (program_id, cycle_id, youth_id);
CREATE INDEX idx_program_sessions_program_cycle ON program_sessions(program_id, cycle_id);
CREATE UNIQUE INDEX uq_program_sessions_program_cycle_theme_start
  ON program_sessions(program_id, cycle_id, theme, starts_at) NULLS NOT DISTINCT;
CREATE INDEX idx_program_enrollments_program_cycle ON program_enrollments(program_id, cycle_id);
ALTER TABLE time_entries DROP CONSTRAINT fk_time_entries_program_cycle,
  ADD CONSTRAINT fk_time_entries_program_cycle FOREIGN KEY (program_id, cycle_id)
    REFERENCES program_cycle_assignments(program_id, cycle_id) ON DELETE RESTRICT;

CREATE OR REPLACE FUNCTION enforce_session_within_cycle_dates()
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
  FROM program_cycles cycle
  CROSS JOIN programs program
  WHERE cycle.id = NEW.cycle_id AND program.id = NEW.program_id;

  IF (NEW.starts_at AT TIME ZONE program_timezone)::date < cycle_starts_on
     OR (NEW.ends_at AT TIME ZONE program_timezone)::date > cycle_ends_on THEN
    RAISE EXCEPTION 'Session must fall within its program cycle date range'
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
    FROM program_sessions session
    INNER JOIN programs program ON program.id = session.program_id
    WHERE session.cycle_id = NEW.id
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

CREATE TRIGGER program_sessions_within_cycle_dates
BEFORE INSERT OR UPDATE OF program_id, cycle_id, starts_at, ends_at ON program_sessions
FOR EACH ROW EXECUTE FUNCTION enforce_session_within_cycle_dates();
DROP FUNCTION enforce_session_within_cohort_dates();

CREATE OR REPLACE FUNCTION enforce_session_note_has_youth_in_roster()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM session_notes sn
        INNER JOIN program_sessions cs ON cs.id = sn.session_id
        INNER JOIN programs p ON p.id = cs.program_id
        WHERE sn.id = NEW.note_id
          AND (
            (
                p.enrollment_required
                AND EXISTS (
                    SELECT 1
                    FROM program_enrollments ce
                    WHERE ce.program_id = cs.program_id AND ce.cycle_id = cs.cycle_id
                      AND ce.youth_id = NEW.youth_id
                      AND ce.enrolled_on <= (cs.starts_at AT TIME ZONE 'America/Toronto')::date
                      AND (
                          ce.withdrawn_on IS NULL
                          OR ce.withdrawn_on > (cs.starts_at AT TIME ZONE 'America/Toronto')::date
                      )
                )
            )
            OR (
                NOT p.enrollment_required
                AND EXISTS (
                    SELECT 1
                    FROM attendance_records ar
                    WHERE ar.session_id = cs.id
                      AND ar.youth_id = NEW.youth_id
                      AND ar.status = 'present'
                )
            )
          )
    ) THEN
        RAISE EXCEPTION 'Session notes can only reference youth in the session roster'
            USING ERRCODE = '23514';
    END IF;

    RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION enforce_session_attachment_has_youth_in_roster()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM session_attachments sa
        INNER JOIN program_sessions cs ON cs.id = sa.session_id
        INNER JOIN programs p ON p.id = cs.program_id
        WHERE sa.id = NEW.attachment_id
          AND (
            (
                p.enrollment_required
                AND EXISTS (
                    SELECT 1
                    FROM program_enrollments ce
                    WHERE ce.program_id = cs.program_id AND ce.cycle_id = cs.cycle_id
                      AND ce.youth_id = NEW.youth_id
                      AND ce.enrolled_on <= (cs.starts_at AT TIME ZONE 'America/Toronto')::date
                      AND (
                          ce.withdrawn_on IS NULL
                          OR ce.withdrawn_on > (cs.starts_at AT TIME ZONE 'America/Toronto')::date
                      )
                )
            )
            OR (
                NOT p.enrollment_required
                AND EXISTS (
                    SELECT 1
                    FROM attendance_records ar
                    WHERE ar.session_id = cs.id
                      AND ar.youth_id = NEW.youth_id
                      AND ar.status = 'present'
                )
            )
          )
    ) THEN
        RAISE EXCEPTION 'Session attachments can only reference youth in the session roster'
            USING ERRCODE = '23514';
    END IF;

    RETURN NEW;
END;
$$;

DROP TABLE program_cohorts;
