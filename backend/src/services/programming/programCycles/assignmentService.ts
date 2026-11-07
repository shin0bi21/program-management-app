import { getYouthRowsByIds } from '../../youth/youthRowQuery';
import { asTransactionSql, sql } from '../../../db/client';
import { ConflictError, NotFoundError } from '../../../errors';
import { programAccessPredicate } from '../../../policies/programAccessPolicy';
import type { AccessTokenPayload } from '../../../types/auth';
import { getProgramCycleRowsByKeys, getProgramCycleYouthIds, type ProgramCycleKey } from './programCycleRowQuery';

/**
 * Replaces a program's cycle assignments and returns affected rows.
 * @param programId - Program whose assignments change.
 * @param cycleIds - Complete set of selected cycle IDs.
 * @param actor - User whose program access is checked.
 * @example setProgramCycles(programId, [], actor) // remove unused assignments
 */
export async function setProgramCycles(programId: string, cycleIds: string[], actor: AccessTokenPayload) {
  // 1. Check access and lock the program.
  return sql.begin(async tx => {
    const trx = asTransactionSql(tx);
    await lockAssignmentProgram(trx, programId, actor);

    // 2. Check the selected cycles.
    const cycles = await trx<{ id: string }[]>`
      SELECT id
      FROM program_cycles
      WHERE id = ANY(${sql.array(cycleIds)}::uuid[])
      ORDER BY id
      FOR KEY SHARE
    `;
    if (cycles.length !== cycleIds.length) throw new NotFoundError('One or more cycles were not found');

    // 3. Check assignments being removed.
    const current = await trx<ProgramCycleKey[]>`
      SELECT program_id, cycle_id
      FROM program_cycle_assignments
      WHERE program_id = ${programId}
      ORDER BY cycle_id
      FOR UPDATE
    `;
    const removed = current.filter(key => !cycleIds.includes(key.cycleId));
    for (const key of removed) await assertAssignmentUnused(trx, key.programId, key.cycleId);

    // 4. Save the program assignments.
    for (const key of removed) {
      await trx`
        DELETE
        FROM program_cycle_assignments
        WHERE program_id = ${key.programId} AND cycle_id = ${key.cycleId}
      `;
    }
    const created = await trx<ProgramCycleKey[]>`
      INSERT INTO program_cycle_assignments (program_id, cycle_id, created_by, updated_by)
      SELECT ${programId}, cycle_id, ${actor.userId}, ${actor.userId}
      FROM UNNEST(${sql.array(cycleIds)}::uuid[]) AS selected(cycle_id)
      ON CONFLICT (program_id, cycle_id) DO NOTHING
      RETURNING program_id, cycle_id
    `;
    const retained = current.filter(key => cycleIds.includes(key.cycleId));
    const keys = [...retained, ...created];

    // 5. Return the affected rows.
    return {
      programId,
      cycleIds: cycles.map(cycle => cycle.id),
      updatedProgramCycles: actor.permissions.includes('read:programs')
        ? await getProgramCycleRowsByKeys(trx, actor, keys) : [],
      createdProgramCycles: created,
      removedProgramCycles: removed,
      updatedYouth: actor.permissions.includes('read:youth_profiles')
        ? await getYouthRowsByIds(trx, await getProgramCycleYouthIds(trx, keys)) : [],
    };
  });
}

/**
 * Locks an accessible program inside the caller's transaction.
 * @param trx - Transaction holding the lock.
 * @param programId - Program to lock.
 * @param actor - User whose access is checked.
 * @example lockAssignmentProgram(trx, programId, actor)
 */
export async function lockAssignmentProgram(trx: typeof sql, programId: string, actor: AccessTokenPayload) {
  const programs = await trx`
    SELECT p.id
    FROM programs p
    WHERE p.id = ${programId} AND ${programAccessPredicate(actor, sql`p.id`)} FOR UPDATE
  `;
  if (!programs.length) throw new NotFoundError('Program not found');
}

/**
 * Rejects removing an assignment with sessions, enrollments, or hours.
 * @param trx - Transaction holding the assignment lock.
 * @param programId - Assigned program.
 * @param cycleId - Assigned cycle.
 * @example assertAssignmentUnused(trx, programId, cycleId) // throws 409 when used
 */
export async function assertAssignmentUnused(trx: typeof sql, programId: string, cycleId: string) {
  // The caller locks the pair, preventing child FK inserts until removal commits.
  const [dependencies] = await trx<{ inUse: boolean }[]>`
    SELECT EXISTS (SELECT 1
    FROM program_sessions
    WHERE program_id = ${programId} AND cycle_id = ${cycleId})
      OR EXISTS (
        SELECT 1
        FROM program_enrollments
        WHERE program_id = ${programId} AND cycle_id = ${cycleId}
      )
      OR EXISTS (
        SELECT 1
        FROM time_entries
        WHERE program_id = ${programId} AND cycle_id = ${cycleId}
      ) AS in_use
  `;
  if (dependencies.inUse) {
    throw new ConflictError('Program assignment cannot be removed because it has sessions, enrollments, or logged hours');
  }
}
