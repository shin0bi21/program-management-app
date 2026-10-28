ALTER TABLE programs RENAME COLUMN roster_mode TO enrollment_required;

ALTER TABLE programs
    ALTER COLUMN enrollment_required DROP DEFAULT,
    ALTER COLUMN enrollment_required TYPE BOOLEAN
        USING (enrollment_required = 'enrolled'::program_roster_mode),
    ALTER COLUMN enrollment_required SET DEFAULT TRUE;

DROP TYPE program_roster_mode;


CREATE OR REPLACE FUNCTION enforce_session_note_has_youth_in_roster()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM session_notes sn
        INNER JOIN cohort_sessions cs ON cs.id = sn.session_id
        INNER JOIN program_cohorts pc ON pc.id = cs.cohort_id
        INNER JOIN programs p ON p.id = pc.program_id
        WHERE sn.id = NEW.note_id
          AND (
            (
                p.enrollment_required
                AND EXISTS (
                    SELECT 1
                    FROM cohort_enrollments ce
                    WHERE ce.cohort_id = cs.cohort_id
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
        INNER JOIN cohort_sessions cs ON cs.id = sa.session_id
        INNER JOIN program_cohorts pc ON pc.id = cs.cohort_id
        INNER JOIN programs p ON p.id = pc.program_id
        WHERE sa.id = NEW.attachment_id
          AND (
            (
                p.enrollment_required
                AND EXISTS (
                    SELECT 1
                    FROM cohort_enrollments ce
                    WHERE ce.cohort_id = cs.cohort_id
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
