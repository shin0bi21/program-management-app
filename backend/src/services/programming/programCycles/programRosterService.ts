import { sql } from '../../../db/client';
import { ConflictError, NotFoundError } from '../../../errors';
import { assertCanAccessProgramCycle } from '../../../policies/programAccessPolicy';
import type { AccessTokenPayload } from '../../../types/auth';

export interface ProgramCycleRosterYouthRow {
  id: string;
  firstName: string;
  lastName: string;
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
 * @example getProgramRosterYouth(programId, cycleId, actor) // excludes conflicting programs
 */
export async function getProgramRosterYouth(programId: string, cycleId: string, actor: AccessTokenPayload) {
  // 1. Check the selected enrollment-based program and cycle.
  await assertCanAccessProgramCycle(actor, programId, cycleId);

  const age = sql`EXTRACT(YEAR FROM AGE((NOW() AT TIME ZONE 'America/Toronto')::date, youth.date_of_birth))::int`;
  const [programCycle] = await sql<Array<{
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
      cycle.starts_on::text,
      cycle.ends_on::text
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
  const enrollmentPeriod = sql`daterange((NOW() AT TIME ZONE 'America/Toronto')::date, NULL, '[)')
    * daterange(${programCycle.startsOn}::date, ${programCycle.endsOn}::date, '[]')`;

  return sql<ProgramCycleRosterYouthRow[]>`
    SELECT
      youth_user.id,
      youth_user.first_name,
      youth_user.last_name,

      youth.date_of_birth,

      school.name AS school_name,

      ${age} AS age,
      COALESCE((
        SELECT json_agg(json_build_object(
          'programId', enrollment.program_id,
          'cycleId', enrollment.cycle_id,
          'withdrawnOn', enrollment.withdrawn_on
        ))
        FROM program_enrollments enrollment
        WHERE enrollment.program_id = ${programId} AND enrollment.cycle_id = ${cycleId}
          AND enrollment.youth_id = youth_user.id
      ), '[]'::json) AS program_cycles
    FROM users youth_user
    INNER JOIN youth_profiles youth ON youth.user_id = youth_user.id
    INNER JOIN user_roles role ON role.id = youth_user.role_id
    LEFT JOIN schools school ON school.id = youth.school_id
    WHERE role.name = 'youth'
      AND (
        EXISTS (
          SELECT 1
          FROM program_enrollments active_enrollment
          WHERE active_enrollment.program_id = ${programId} AND active_enrollment.cycle_id = ${cycleId}
            AND active_enrollment.youth_id = youth_user.id
            AND active_enrollment.enrolled_on <= (NOW() AT TIME ZONE 'America/Toronto')::date
            AND (
              active_enrollment.withdrawn_on IS NULL
              OR active_enrollment.withdrawn_on > (NOW() AT TIME ZONE 'America/Toronto')::date
            )
        )
        OR (
          (${age} >= ${programCycle.minAge} OR ${programCycle.minAge}::int IS NULL)
          AND (${age} <= ${programCycle.maxAge} OR ${programCycle.maxAge}::int IS NULL)
          AND NOT EXISTS (
            SELECT 1
            FROM program_enrollments other_enrollment
            WHERE other_enrollment.youth_id = youth_user.id
              AND other_enrollment.program_id <> ${programId}
              AND other_enrollment.effective_period && (${enrollmentPeriod})
          )
        )
      )
    ORDER BY LOWER(youth_user.first_name), LOWER(youth_user.last_name), youth_user.id
  `;
}
