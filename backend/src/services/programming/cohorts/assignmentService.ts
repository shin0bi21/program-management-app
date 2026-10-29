import { getYouthRowsByIds } from '../../youth/youthRecordQuery';
import { asTransactionSql, sql } from '../../../db/client';
import { ConflictError, NotFoundError } from '../../../errors';
import { programAccessPredicate } from '../../../policies/programAccessPolicy';
import type { AccessTokenPayload } from '../../../types/auth';
import { getCohortRowsByIds, getCohortYouthIds } from './cohortRecordQuery';

export async function setProgramCycles(programId: string, cycleIds: string[], actor: AccessTokenPayload) {
  return sql.begin(async tx => {
    const trx = asTransactionSql(tx);
    await lockAssignmentProgram(trx, programId, actor);

    const cycles = await trx<{ id: string }[]>`
      SELECT id FROM program_cycles
      WHERE id = ANY(${sql.array(cycleIds)}::uuid[])
      ORDER BY id FOR KEY SHARE
    `;
    if (cycles.length !== cycleIds.length) throw new NotFoundError('One or more cycles were not found');

    const current = await trx<{ id: string; cycleId: string }[]>`
      SELECT id, cycle_id FROM program_cohorts
      WHERE program_id = ${programId}
      ORDER BY id FOR UPDATE
    `;
    const removed = current.filter(cohort => !cycleIds.includes(cohort.cycleId));
    for (const cohort of removed) {
      await assertAssignmentUnused(trx, cohort.id);
    }

    for (const cohort of removed) {
      await trx`DELETE FROM program_cohorts WHERE id = ${cohort.id}`;
    }
    const created = await trx<{ id: string }[]>`
      INSERT INTO program_cohorts (program_id, cycle_id, created_by, updated_by)
      SELECT ${programId}, cycle_id, ${actor.userId}, ${actor.userId}
      FROM UNNEST(${sql.array(cycleIds)}::uuid[]) AS selected(cycle_id)
      ON CONFLICT (program_id, cycle_id) DO NOTHING
      RETURNING id
    `;

    const retained = current.filter(cohort => cycleIds.includes(cohort.cycleId));
    return {
      programId,
      cycleIds: cycles.map(cycle => cycle.id),
      updatedCohorts: actor.permissions.includes('read:programs')
        ? await getCohortRowsByIds(trx, actor, [...retained, ...created].map(cohort => cohort.id)) : [],
      createdCohortIds: created.map(cohort => cohort.id),
      removedCohortIds: removed.map(cohort => cohort.id),
      updatedYouth: actor.permissions.includes('read:youth_profiles')
        ? await getYouthRowsByIds(trx, await getCohortYouthIds(trx, [...retained, ...created].map(cohort => cohort.id))) : [],
    };
  });
}

export async function lockAssignmentProgram(trx: typeof sql, programId: string, actor: AccessTokenPayload) {
  const programs = await trx`
    SELECT p.id FROM programs p
    WHERE p.id = ${programId} AND ${programAccessPredicate(actor, sql`p.id`)}
    FOR UPDATE
  `;
  if (!programs.length) throw new NotFoundError('Program not found');
}

export async function assertAssignmentUnused(trx: typeof sql, cohortId: string) {
  // The caller holds FOR UPDATE on the assignment, blocking child FK inserts until removal commits.
  const [dependencies] = await trx<{ inUse: boolean }[]>`
    SELECT
      EXISTS (SELECT 1 FROM cohort_sessions WHERE cohort_id = ${cohortId})
      OR EXISTS (SELECT 1 FROM cohort_enrollments WHERE cohort_id = ${cohortId})
      OR EXISTS (
        SELECT 1 FROM time_entries entry
        JOIN program_cohorts cohort
          ON cohort.program_id = entry.program_id AND cohort.cycle_id = entry.cycle_id
        WHERE cohort.id = ${cohortId}
      ) AS in_use
  `;
  if (dependencies.inUse) {
    throw new ConflictError('Program assignment cannot be removed because it has sessions, enrollments, or logged hours');
  }
}
