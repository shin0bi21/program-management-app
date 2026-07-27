import { asTransactionSql, sql } from '../db/client';
import { ConflictError, NotFoundError } from '../errors';
import { assertCohortAccess } from '../policies/programAccessPolicy';
import type { AccessTokenPayload } from '../types/auth';
import type { EnrollYouthInput } from '../validation/cohortSchemas';

export async function enrollYouth(cohortId: string, data: EnrollYouthInput, actor: AccessTokenPayload) {
  await assertCohortAccess(actor, cohortId);
  return sql.begin(async tx => {
    const trx = asTransactionSql(tx);
    const cohorts = await trx<{ id: string; rosterMode: 'enrolled' | 'open' }[]>`
      SELECT pc.id, p.roster_mode
      FROM program_cohorts pc
      INNER JOIN programs p ON p.id = pc.program_id
      WHERE pc.id = ${cohortId}
    `;
    if (!cohorts.length) throw new NotFoundError('Cohort not found');
    if (cohorts[0].rosterMode === 'open') {
      throw new ConflictError('Open attendance cohorts do not use enrollment');
    }

    const youth = await trx<{ id: string }[]>`
      SELECT user_id AS id
      FROM youth_profiles
      WHERE user_id = ANY(${sql.array(data.youthIds)}::uuid[])
    `;
    if (youth.length !== data.youthIds.length) {
      throw new NotFoundError('One or more youth profiles were not found');
    }

    return trx`
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
  });
}

export async function withdrawYouth(
  cohortId: string,
  youthId: string,
  actor: AccessTokenPayload,
) {
  await assertCohortAccess(actor, cohortId);
  const rows = await sql`
    UPDATE cohort_enrollments
    SET
      withdrawn_on = (NOW() AT TIME ZONE 'America/Toronto')::date,
      updated_at = NOW(),
      updated_by = ${actor.userId}
    WHERE cohort_id = ${cohortId}
      AND youth_id = ${youthId}
      AND withdrawn_on IS NULL
    RETURNING
      id,
      cohort_id,
      youth_id,
      enrolled_on::text AS enrolled_on,
      withdrawn_on::text AS withdrawn_on,
      created_at,
      updated_at
  `;
  if (!rows.length) throw new NotFoundError('Active cohort enrollment not found');
  return rows[0];
}
