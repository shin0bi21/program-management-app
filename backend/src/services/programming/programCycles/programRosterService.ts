import { sql } from '../../../db/client';
import { ConflictError, NotFoundError } from '../../../errors';
import { assertCanAccessProgramCycle } from '../../../policies/programAccessPolicy';
import type { AccessTokenPayload } from '../../../types/auth';

export interface ProgramCycleRosterYouthRow {
  id: string;
  firstName: string;
  lastName: string;
  dateOfBirth: string | null;
  age: number | null;
  schoolName: string | null;
  programCycles: Array<{
    programId: string;
    cycleId: string;
    withdrawnOn: string | null;
  }>;
}

export async function getProgramRosterYouth(programId: string, cycleId: string, actor: AccessTokenPayload) {
  await assertCanAccessProgramCycle(actor, programId, cycleId);

  const age = sql`EXTRACT(YEAR FROM AGE((NOW() AT TIME ZONE 'America/Toronto')::date, yp.date_of_birth))::int`;
  const programCycles = await sql<Array<{
    enrollmentRequired: boolean;
    minAge: number | null;
    maxAge: number | null;
  }>>`
    SELECT
      p.enrollment_required,
      p.min_age,
      p.max_age
    FROM program_cycle_assignments pc
    INNER JOIN programs p ON p.id = pc.program_id
    WHERE pc.program_id = ${programId} AND pc.cycle_id = ${cycleId}
  `;

  if (!programCycles.length) throw new NotFoundError('Program cycle not found');
  const programCycle = programCycles[0];
  if (!programCycle.enrollmentRequired) {
    throw new ConflictError('Open attendance programs do not use enrollment');
  }

  return sql<ProgramCycleRosterYouthRow[]>`
    SELECT
      u.id,
      u.first_name,
      u.last_name,
      yp.date_of_birth,
      ${age} AS age,
      s.name AS school_name,
      COALESCE((
        SELECT json_agg(json_build_object(
          'programId', ce.program_id,
          'cycleId', ce.cycle_id,
          'withdrawnOn', ce.withdrawn_on
        ))
        FROM program_enrollments ce
        WHERE ce.program_id = ${programId} AND ce.cycle_id = ${cycleId}
          AND ce.youth_id = u.id
      ), '[]'::json) AS program_cycles
    FROM youth_profiles yp
    INNER JOIN users u ON u.id = yp.user_id
    INNER JOIN user_roles ur ON ur.id = u.role_id
    LEFT JOIN schools s ON s.id = yp.school_id
    WHERE ur.name = 'youth'
      AND (
        EXISTS (
          SELECT 1
          FROM program_enrollments active_enrollment
          WHERE active_enrollment.program_id = ${programId} AND active_enrollment.cycle_id = ${cycleId}
            AND active_enrollment.youth_id = u.id
            AND active_enrollment.enrolled_on <= (NOW() AT TIME ZONE 'America/Toronto')::date
            AND (
              active_enrollment.withdrawn_on IS NULL
              OR active_enrollment.withdrawn_on > (NOW() AT TIME ZONE 'America/Toronto')::date
            )
        )
        OR (
          (${age} >= ${programCycle.minAge} OR ${programCycle.minAge}::int IS NULL)
          AND (${age} <= ${programCycle.maxAge} OR ${programCycle.maxAge}::int IS NULL)
        )
      )
    ORDER BY LOWER(u.first_name), LOWER(u.last_name), u.id
  `;
}
