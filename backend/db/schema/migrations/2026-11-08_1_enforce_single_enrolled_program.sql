-- Keep enrollment history, but reject overlapping membership in different enrolled programs.
-- Migration preparation must resolve legacy conflicts explicitly before retrying.
LOCK TABLE programs, program_cycles, program_enrollments IN SHARE ROW EXCLUSIVE MODE;

DO $$
DECLARE
  conflicting_pairs bigint;
  affected_youth bigint;
BEGIN
  WITH memberships AS (
    SELECT enrollment.id, enrollment.youth_id, enrollment.program_id,
      daterange(enrollment.enrolled_on, enrollment.withdrawn_on, '[)')
        * daterange(cycle.starts_on, cycle.ends_on, '[]') AS effective_period
    FROM program_enrollments enrollment
    INNER JOIN programs program ON program.id = enrollment.program_id
    INNER JOIN program_cycles cycle ON cycle.id = enrollment.cycle_id
    WHERE program.enrollment_required
  )
  SELECT COUNT(*), COUNT(DISTINCT first_membership.youth_id)
  INTO conflicting_pairs, affected_youth
  FROM memberships first_membership
  INNER JOIN memberships second_membership
    ON first_membership.id < second_membership.id
    AND first_membership.youth_id = second_membership.youth_id
    AND first_membership.program_id <> second_membership.program_id
    AND first_membership.effective_period && second_membership.effective_period;

  IF conflicting_pairs > 0 THEN
    RAISE EXCEPTION 'Cannot enforce single enrolled program: % overlapping enrollment pairs affect % youth',
      conflicting_pairs, affected_youth
      USING HINT = 'Review conflicting enrollment and cycle dates; do not discard or automatically withdraw historical records.';
  END IF;
END;
$$;

CREATE EXTENSION IF NOT EXISTS btree_gist WITH SCHEMA public;

ALTER TABLE program_enrollments
  ADD COLUMN effective_period daterange NOT NULL DEFAULT 'empty'::daterange;

COMMENT ON COLUMN program_enrollments.effective_period IS
  'Trigger-maintained enrollment/cycle date intersection; empty for open-attendance programs.';

UPDATE program_enrollments enrollment
SET effective_period = CASE
  WHEN program.enrollment_required THEN
    daterange(enrollment.enrolled_on, enrollment.withdrawn_on, '[)')
      * daterange(cycle.starts_on, cycle.ends_on, '[]')
  ELSE 'empty'::daterange
END
FROM programs program, program_cycles cycle
WHERE program.id = enrollment.program_id AND cycle.id = enrollment.cycle_id;

ALTER TABLE program_enrollments
  ADD CONSTRAINT program_enrollments_one_program_per_youth
  EXCLUDE USING gist (youth_id WITH =, program_id WITH <>, effective_period WITH &&);

-- Derive the enrolled portion of a cycle. For example, a June 1 withdrawal excludes June 1.
-- Parent tuple versions serialize concurrent parent edits even under repeatable-read snapshots.
CREATE FUNCTION set_enrollment_effective_period() RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
DECLARE
  requires_enrollment boolean;
  cycle_starts_on date;
  cycle_ends_on date;
BEGIN
  UPDATE programs
  SET enrollment_required = enrollment_required
  WHERE id = NEW.program_id
  RETURNING enrollment_required INTO requires_enrollment;

  UPDATE program_cycles
  SET updated_at = updated_at
  WHERE id = NEW.cycle_id
  RETURNING starts_on, ends_on INTO cycle_starts_on, cycle_ends_on;

  NEW.effective_period := 'empty'::daterange;
  IF requires_enrollment
    AND cycle_starts_on IS NOT NULL
    AND NEW.enrolled_on IS NOT NULL
    AND (NEW.withdrawn_on IS NULL OR NEW.withdrawn_on >= NEW.enrolled_on)
  THEN
    NEW.effective_period := daterange(NEW.enrolled_on, NEW.withdrawn_on, '[)')
      * daterange(cycle_starts_on, cycle_ends_on, '[]');
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER program_enrollment_effective_period
BEFORE INSERT OR UPDATE ON program_enrollments
FOR EACH ROW EXECUTE FUNCTION set_enrollment_effective_period();

-- Revalidate child memberships when their parent changes, without altering audit values.
-- For example, extending a cycle into another program's membership rejects the entire edit.
CREATE FUNCTION refresh_enrollment_effective_periods() RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
DECLARE
  enrollment_id uuid;
BEGIN
  FOR enrollment_id IN
    SELECT id
    FROM program_enrollments
    WHERE (TG_TABLE_NAME = 'programs' AND program_id = NEW.id)
      OR (TG_TABLE_NAME = 'program_cycles' AND cycle_id = NEW.id)
    ORDER BY youth_id, id
  LOOP
    UPDATE program_enrollments
    SET effective_period = effective_period
    WHERE id = enrollment_id;
  END LOOP;

  RETURN NULL;
END;
$$;

CREATE TRIGGER program_mode_refreshes_enrollments
AFTER UPDATE OF enrollment_required ON programs
FOR EACH ROW
WHEN (OLD.enrollment_required IS DISTINCT FROM NEW.enrollment_required)
EXECUTE FUNCTION refresh_enrollment_effective_periods();

CREATE TRIGGER cycle_dates_refresh_enrollments
AFTER UPDATE OF starts_on, ends_on ON program_cycles
FOR EACH ROW
WHEN (OLD.starts_on IS DISTINCT FROM NEW.starts_on OR OLD.ends_on IS DISTINCT FROM NEW.ends_on)
EXECUTE FUNCTION refresh_enrollment_effective_periods();
