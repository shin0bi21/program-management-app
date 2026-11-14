import { sql } from '../../../db/client';
import { ConflictError, NotFoundError } from '../../../errors';
import { assertCanAccessProgramCycle } from '../../../policies/programAccessPolicy';
import type { AccessTokenPayload } from '../../../types/auth';

export interface ProgramCycleRosterYouthRow {
  id: string;
  firstName: string;
  lastName: string;
  /** Calendar date in YYYY-MM-DD format, or null when unknown. */
  dateOfBirth: string | null;
  schoolName: string | null;
  age: number | null;
  programCycles: Array<{
    programId: string;
    cycleId: string;
    withdrawnOn: string | null;
  }>;
}

/**
 * Lists age-eligible youth available for this enrollment period and retained members.
 * @param programId - Enrollment-based program whose roster is being edited.
 * @param cycleId - Assigned cycle that bounds a new enrollment.
 * @param actor - Actor whose program access must be checked.
 * @param query - Database client or transaction used for the roster read.
 * @returns Available candidates and retained youth, with date-only birth dates and ages in years.
 * @throws ConflictError when the program does not use enrollment.
 * @example getProgramRosterYouth(programId, cycleId, actor) // excludes conflicting programs
 */
export async function getProgramRosterYouth(programId: string, cycleId: string, actor: AccessTokenPayload, query = sql) {
  // 1. Check the selected enrollment-based program and cycle.
  await assertCanAccessProgramCycle(actor, programId, cycleId);

  const ageInYears = query`EXTRACT(YEAR FROM AGE(CURRENT_DATE, profile.date_of_birth))::int`;
  const [programCycle] = await query<Array<{
    enrollmentRequired: boolean;
    minAge: number | null;
    maxAge: number | null;
    startsOn: string;
    endsOn: string;
  }>>`
    SELECT
      program.enrollment_required,
      program.min_age,
      program.max_age,

      cycle.starts_on,
      cycle.ends_on
    FROM program_cycle_assignments assignment
    INNER JOIN programs program ON program.id = assignment.program_id
    INNER JOIN program_cycles cycle ON cycle.id = assignment.cycle_id
    WHERE assignment.program_id = ${programId} AND assignment.cycle_id = ${cycleId}
  `;

  if (!programCycle) throw new NotFoundError('Program cycle not found');
  if (!programCycle.enrollmentRequired) {
    throw new ConflictError('Open attendance programs do not use enrollment');
  }

  // 2. Keep retained members and available candidates for a new enrollment today.
  const enrollmentPeriod = query`daterange(CURRENT_DATE, NULL, '[)')
    * daterange(${programCycle.startsOn}::date, ${programCycle.endsOn}::date, '[]')`;

  return query<ProgramCycleRosterYouthRow[]>`
    SELECT
      youth.id,
      youth.first_name,
      youth.last_name,

      profile.date_of_birth,

      school.name AS school_name,

      ${ageInYears} AS age,
      COALESCE((
        SELECT json_agg(json_build_object(
          'programId', enrollment.program_id,
          'cycleId', enrollment.cycle_id,
          'withdrawnOn', enrollment.withdrawn_on
        ))
        FROM program_enrollments enrollment
        WHERE enrollment.program_id = ${programId} AND enrollment.cycle_id = ${cycleId}
          AND enrollment.youth_id = youth.id
      ), '[]'::json) AS program_cycles
    FROM users youth
    INNER JOIN youth_profiles profile ON profile.user_id = youth.id
    INNER JOIN user_roles role ON role.id = youth.role_id
    LEFT JOIN schools school ON school.id = profile.school_id
    WHERE role.name = 'youth'
      AND (
        EXISTS (
          SELECT 1
          FROM program_enrollments active_enrollment
          WHERE active_enrollment.program_id = ${programId} AND active_enrollment.cycle_id = ${cycleId}
            AND active_enrollment.youth_id = youth.id
            AND active_enrollment.enrolled_on <= CURRENT_DATE
            AND (
              active_enrollment.withdrawn_on IS NULL
              OR active_enrollment.withdrawn_on > CURRENT_DATE
            )
        )
        OR (
          (${ageInYears} >= ${programCycle.minAge} OR ${programCycle.minAge}::int IS NULL)
          AND (${ageInYears} <= ${programCycle.maxAge} OR ${programCycle.maxAge}::int IS NULL)
          AND NOT EXISTS (
            SELECT 1
            FROM program_enrollments other_enrollment
            WHERE other_enrollment.youth_id = youth.id
              AND other_enrollment.program_id <> ${programId}
              AND other_enrollment.effective_period && (${enrollmentPeriod})
          )
        )
      )
    ORDER BY LOWER(youth.first_name), LOWER(youth.last_name), youth.id
  `;
}
