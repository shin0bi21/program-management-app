-- Preserve Eastern local schedules while replacing timestamp storage with one date and two times.
LOCK TABLE public.program_sessions IN ACCESS EXCLUSIVE MODE;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM public.program_sessions
    WHERE (starts_at AT TIME ZONE 'America/Toronto')::date
          <> (ends_at AT TIME ZONE 'America/Toronto')::date
       OR (ends_at AT TIME ZONE 'America/Toronto')::time
          <= (starts_at AT TIME ZONE 'America/Toronto')::time
       OR EXTRACT(SECOND FROM starts_at AT TIME ZONE 'America/Toronto') <> 0
       OR EXTRACT(SECOND FROM ends_at AT TIME ZONE 'America/Toronto') <> 0
       OR (starts_at AT TIME ZONE 'America/Toronto')::date
          NOT BETWEEN DATE '0001-01-01' AND DATE '9999-12-31'
  ) THEN
    RAISE EXCEPTION 'Session date migration requires same-day, whole-minute ordered schedules in supported years; review exceptional records before retrying';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.programs
    WHERE EXTRACT(SECOND FROM default_start_time) <> 0
       OR EXTRACT(SECOND FROM default_end_time) <> 0
  ) THEN
    RAISE EXCEPTION 'Program defaults must use whole minutes; review exceptional records before retrying';
  END IF;
END;
$$;

ALTER TABLE public.program_sessions
  ADD COLUMN date DATE,
  ADD COLUMN start_time TIME WITHOUT TIME ZONE,
  ADD COLUMN end_time TIME WITHOUT TIME ZONE;

UPDATE public.program_sessions
SET date = (starts_at AT TIME ZONE 'America/Toronto')::date,
    start_time = (starts_at AT TIME ZONE 'America/Toronto')::time,
    end_time = (ends_at AT TIME ZONE 'America/Toronto')::time;

ALTER TABLE public.program_sessions
  ALTER COLUMN date SET NOT NULL,
  ALTER COLUMN start_time SET NOT NULL,
  ALTER COLUMN end_time SET NOT NULL,
  ADD CONSTRAINT program_sessions_date_check
    CHECK (date BETWEEN DATE '0001-01-01' AND DATE '9999-12-31'),
  ADD CONSTRAINT program_sessions_time_check
    CHECK (end_time > start_time AND end_time < TIME '24:00'
      AND EXTRACT(SECOND FROM start_time) = 0 AND EXTRACT(SECOND FROM end_time) = 0);

ALTER TABLE public.programs
  ADD CONSTRAINT programs_default_time_minutes_check
    CHECK (EXTRACT(SECOND FROM default_start_time) = 0 AND EXTRACT(SECOND FROM default_end_time) = 0);

CREATE OR REPLACE FUNCTION public.enforce_cycle_dates_contain_sessions() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM program_sessions session
    INNER JOIN programs program ON program.id = session.program_id
    WHERE session.cycle_id = NEW.id
      AND (
        session.date < NEW.starts_on
        OR session.date > NEW.ends_on
      )
  ) THEN
    RAISE EXCEPTION 'Cycle dates must contain all existing sessions'
      USING ERRCODE = '23514';
  END IF;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.enforce_session_attachment_has_youth_in_roster() RETURNS trigger
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
                      AND ce.enrolled_on <= cs.date
                      AND (
                          ce.withdrawn_on IS NULL
                          OR ce.withdrawn_on > cs.date
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

CREATE OR REPLACE FUNCTION public.enforce_session_note_has_youth_in_roster() RETURNS trigger
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
                      AND ce.enrolled_on <= cs.date
                      AND (
                          ce.withdrawn_on IS NULL
                          OR ce.withdrawn_on > cs.date
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

CREATE OR REPLACE FUNCTION public.enforce_session_within_cycle_dates() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
DECLARE
  cycle_starts_on DATE;
  cycle_ends_on DATE;
BEGIN
  SELECT cycle.starts_on, cycle.ends_on
  INTO cycle_starts_on, cycle_ends_on
  FROM program_cycles cycle
  CROSS JOIN programs program
  WHERE cycle.id = NEW.cycle_id AND program.id = NEW.program_id;

  IF NEW.date < cycle_starts_on
     OR NEW.date > cycle_ends_on THEN
    RAISE EXCEPTION 'Session must fall within its program cycle date range'
      USING ERRCODE = '23514';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER program_sessions_within_cycle_dates ON public.program_sessions;
DROP INDEX public.idx_cohort_sessions_starts_at;
DROP INDEX public.uq_program_sessions_program_cycle_theme_start;

ALTER TABLE public.program_sessions DROP COLUMN starts_at, DROP COLUMN ends_at;

CREATE INDEX idx_program_sessions_date_time
  ON public.program_sessions (date, start_time);
CREATE UNIQUE INDEX uq_program_sessions_program_cycle_theme_start
  ON public.program_sessions (program_id, cycle_id, theme, date, start_time) NULLS NOT DISTINCT;

CREATE TRIGGER program_sessions_within_cycle_dates
  BEFORE INSERT OR UPDATE OF program_id, cycle_id, date
  ON public.program_sessions FOR EACH ROW
  EXECUTE FUNCTION public.enforce_session_within_cycle_dates();
