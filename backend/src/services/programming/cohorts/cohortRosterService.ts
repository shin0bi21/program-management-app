import { sql } from '../../../db/client';
import { ConflictError, NotFoundError } from '../../../errors';
import { assertCanAccessCohort } from '../../../policies/programAccessPolicy';
import type { AccessTokenPayload } from '../../../types/auth';

export interface CohortRosterYouthRow {
  id: string;
  firstName: string;
  lastName: string;
  dateOfBirth: string | null;
  age: number | null;
  schoolName: string | null;
  cohorts: Array<{
    id: string;
    withdrawnOn: string | null;
  }>;
}

export async function getCohortRosterYouth(cohortId: string, actor: AccessTokenPayload) {
  await assertCanAccessCohort(actor, cohortId);

  const age = sql`EXTRACT(YEAR FROM AGE((NOW() AT TIME ZONE 'America/Toronto')::date, yp.date_of_birth))::int`;
  const cohorts = await sql<Array<{
    enrollmentRequired: boolean;
    minAge: number | null;
    maxAge: number | null;
  }>>`
    SELECT
      p.enrollment_required,
      p.min_age,
      p.max_age
    FROM program_cohorts pc
    INNER JOIN programs p ON p.id = pc.program_id
    WHERE pc.id = ${cohortId}
  `;

  if (!cohorts.length) throw new NotFoundError('Cohort not found');
  const cohort = cohorts[0];
  if (!cohort.enrollmentRequired) {
    throw new ConflictError('Open attendance cohorts do not use enrollment');
  }

  return sql<CohortRosterYouthRow[]>`
    SELECT
      u.id,
      u.first_name,
      u.last_name,
      yp.date_of_birth,
      ${age} AS age,
      s.name AS school_name,
      COALESCE((
        SELECT json_agg(json_build_object(
          'id', ce.cohort_id,
          'withdrawnOn', ce.withdrawn_on
        ))
        FROM cohort_enrollments ce
        WHERE ce.cohort_id = ${cohortId}
          AND ce.youth_id = u.id
      ), '[]'::json) AS cohorts
    FROM youth_profiles yp
    INNER JOIN users u ON u.id = yp.user_id
    INNER JOIN user_roles ur ON ur.id = u.role_id
    LEFT JOIN schools s ON s.id = yp.school_id
    WHERE ur.name = 'youth'
      AND (
        EXISTS (
          SELECT 1
          FROM cohort_enrollments active_enrollment
          WHERE active_enrollment.cohort_id = ${cohortId}
            AND active_enrollment.youth_id = u.id
            AND active_enrollment.enrolled_on <= (NOW() AT TIME ZONE 'America/Toronto')::date
            AND (
              active_enrollment.withdrawn_on IS NULL
              OR active_enrollment.withdrawn_on > (NOW() AT TIME ZONE 'America/Toronto')::date
            )
        )
        OR (
          (${age} >= ${cohort.minAge} OR ${cohort.minAge}::int IS NULL)
          AND (${age} <= ${cohort.maxAge} OR ${cohort.maxAge}::int IS NULL)
        )
      )
    ORDER BY LOWER(u.first_name), LOWER(u.last_name), u.id
  `;
}
