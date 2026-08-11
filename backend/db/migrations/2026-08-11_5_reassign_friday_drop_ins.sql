DO $$
DECLARE
  friday_drop_ins_cycle_id UUID;
  spring_cycle_id UUID;
BEGIN
  SELECT id INTO friday_drop_ins_cycle_id
  FROM program_cycles
  WHERE name = 'Friday Drop Ins';

  IF friday_drop_ins_cycle_id IS NULL THEN
    RETURN;
  END IF;

  SELECT id INTO spring_cycle_id
  FROM program_cycles
  WHERE name = 'Spring 2026';

  IF spring_cycle_id IS NULL THEN
    RAISE EXCEPTION 'Spring 2026 cycle is required to reassign Friday Drop Ins';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM cohort_sessions session
    INNER JOIN program_cohorts cohort ON cohort.id = session.cohort_id
    WHERE cohort.cycle_id = friday_drop_ins_cycle_id
      AND (session.starts_at AT TIME ZONE 'America/Toronto')::date > DATE '2026-08-11'
      AND (
        EXISTS (SELECT 1 FROM attendance_records attendance WHERE attendance.session_id = session.id)
        OR EXISTS (SELECT 1 FROM session_notes note WHERE note.session_id = session.id)
        OR EXISTS (SELECT 1 FROM session_attachments attachment WHERE attachment.session_id = session.id)
        OR EXISTS (SELECT 1 FROM time_entries entry WHERE entry.session_id = session.id)
      )
  ) THEN
    RAISE EXCEPTION 'Friday Drop Ins sessions after 2026-08-11 have linked records';
  END IF;

  DELETE FROM cohort_sessions session
  USING program_cohorts cohort
  WHERE session.cohort_id = cohort.id
    AND cohort.cycle_id = friday_drop_ins_cycle_id
    AND (session.starts_at AT TIME ZONE 'America/Toronto')::date > DATE '2026-08-11';

  IF EXISTS (
    SELECT 1
    FROM cohort_sessions session
    INNER JOIN program_cohorts cohort ON cohort.id = session.cohort_id
    INNER JOIN program_cycles spring ON spring.id = spring_cycle_id
    WHERE cohort.cycle_id = friday_drop_ins_cycle_id
      AND (
        (session.starts_at AT TIME ZONE 'America/Toronto')::date < spring.starts_on
        OR (session.ends_at AT TIME ZONE 'America/Toronto')::date > spring.ends_on
      )
  ) THEN
    RAISE EXCEPTION 'Remaining Friday Drop Ins sessions do not fit Spring 2026';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM program_cohorts source
    INNER JOIN program_cohorts target
      ON target.program_id = source.program_id
      AND target.cycle_id = spring_cycle_id
    WHERE source.cycle_id = friday_drop_ins_cycle_id
  ) THEN
    RAISE EXCEPTION 'A Spring 2026 cohort already exists for the Friday Drop Ins program';
  END IF;

  UPDATE program_cohorts
  SET cycle_id = spring_cycle_id,
      updated_at = NOW()
  WHERE cycle_id = friday_drop_ins_cycle_id;

  DELETE FROM program_cycles
  WHERE id = friday_drop_ins_cycle_id;
END;
$$;
