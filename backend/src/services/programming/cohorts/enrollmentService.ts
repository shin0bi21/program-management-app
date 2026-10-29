import { asTransactionSql, sql } from '../../../db/client';
import { ConflictError, NotFoundError } from '../../../errors';
import { assertCanAccessCohort } from '../../../policies/programAccessPolicy';
import { lockAssignmentProgram } from './assignmentService';
import type { AccessTokenPayload } from '../../../types/auth';
import type { EnrollYouthInput } from '../../../validation/cohortSchemas';
import { getCohortRowsByIds } from './cohortRecordQuery';
import { getYouthRowsByIds } from '../../youth/youthRecordQuery';

export async function enrollYouth(cohortId: string, data: EnrollYouthInput, actor: AccessTokenPayload) {
  await assertCanAccessCohort(actor, cohortId);
  return sql.begin(async tx => {
    const trx = asTransactionSql(tx);
    const [assignment] = await trx<{ programId: string }[]>`
      SELECT program_id FROM program_cohorts WHERE id = ${cohortId}
    `;
    if (!assignment) throw new NotFoundError('Cohort not found');

    // Match assignment mutations: lock the program before its cohort, then validate current values.
    await lockAssignmentProgram(trx, assignment.programId, actor);

    const cohorts = await trx<{
      id: string;
      enrollmentRequired: boolean;
      minAge: number | null;
      maxAge: number | null;
    }[]>`
      SELECT pc.id, p.enrollment_required, p.min_age, p.max_age
      FROM program_cohorts pc
      INNER JOIN programs p ON p.id = pc.program_id
      WHERE pc.id = ${cohortId}
      FOR UPDATE OF pc
    `;
    if (!cohorts.length) throw new NotFoundError('Cohort not found');
    if (!cohorts[0].enrollmentRequired) {
      throw new ConflictError('Open attendance cohorts do not use enrollment');
    }

    const age = sql`EXTRACT(YEAR FROM AGE((NOW() AT TIME ZONE 'America/Toronto')::date, date_of_birth))::int`;
    const youth = await trx<{ id: string; age: number | null }[]>`
      SELECT user_id AS id, ${age} AS age
      FROM youth_profiles
      WHERE user_id = ANY(${sql.array(data.youthIds)}::uuid[])
      ORDER BY user_id
      FOR SHARE
    `;
    if (youth.length !== data.youthIds.length) {
      throw new NotFoundError('One or more youth profiles were not found');
    }

    const outsideAgeRange = youth.some(({ age: youthAge }) => (
      (cohorts[0].minAge !== null && (youthAge === null || youthAge < cohorts[0].minAge))
      || (cohorts[0].maxAge !== null && (youthAge === null || youthAge > cohorts[0].maxAge))
    ));
    if (outsideAgeRange) {
      throw new ConflictError('One or more youth profiles do not meet this cohort age range');
    }

    const enrollments = await trx`
      INSERT INTO cohort_enrollments (
        cohort_id, youth_id, created_by, updated_by
      )
      SELECT
        ${cohortId},
        selected.youth_id,
        ${actor.userId},
        ${actor.userId}
      FROM UNNEST(${sql.array(data.youthIds)}::uuid[]) AS selected(youth_id)
      ON CONFLICT (cohort_id, youth_id) DO UPDATE SET
        withdrawn_on = NULL,
        enrolled_on = EXCLUDED.enrolled_on,
        updated_at = NOW(),
        updated_by = EXCLUDED.updated_by
      RETURNING
        id,
        cohort_id,
        youth_id,
        enrolled_on::text AS enrolled_on,
        withdrawn_on::text AS withdrawn_on,
        created_at,
        updated_at
    `;
    const [cohort] = await getCohortRowsByIds(trx, actor, [cohortId]);
    return {
      enrollments,
      cohort,
      updatedYouth: actor.permissions.includes('read:youth_profiles')
        ? await getYouthRowsByIds(trx, data.youthIds) : [],
    };
  });
}

export async function withdrawYouth(
  cohortId: string,
  youthId: string,
  actor: AccessTokenPayload,
) {
  await assertCanAccessCohort(actor, cohortId);
  return sql.begin(async tx => {
    const trx = asTransactionSql(tx);
    const [assignment] = await trx<{ programId: string }[]>`
      SELECT program_id FROM program_cohorts WHERE id = ${cohortId}
    `;
    if (!assignment) throw new NotFoundError('Cohort not found');
    await lockAssignmentProgram(trx, assignment.programId, actor);
    await trx`SELECT id FROM program_cohorts WHERE id = ${cohortId} FOR UPDATE`;

    const [enrollment] = await trx`
      UPDATE cohort_enrollments
      SET withdrawn_on = (NOW() AT TIME ZONE 'America/Toronto')::date,
          updated_at = NOW(), updated_by = ${actor.userId}
      WHERE cohort_id = ${cohortId} AND youth_id = ${youthId} AND withdrawn_on IS NULL
      RETURNING id, cohort_id, youth_id, enrolled_on::text AS enrolled_on,
        withdrawn_on::text AS withdrawn_on, created_at, updated_at
    `;
    if (!enrollment) throw new NotFoundError('Active cohort enrollment not found');

    const [cohort] = await getCohortRowsByIds(trx, actor, [cohortId]);
    return {
      enrollment,
      cohort,
      updatedYouth: actor.permissions.includes('read:youth_profiles')
        ? await getYouthRowsByIds(trx, [youthId]) : [],
    };
  });
}
