import { getYouthRows, type YouthRow } from '../../youth/youthRowQuery';
import { asTransactionSql, sql } from '../../../db/client';
import { ConflictError, NotFoundError, InternalServerError, isUniqueViolation } from '../../../errors';
import { assertAssignmentUnused } from '../programCycles/assignmentService';
import { rethrowEnrollmentConflict } from '../programCycles/enrollmentConflict';
import type { AccessTokenPayload } from '../../../types/auth';
import type { SetProgramCycleInput } from '../../../validation/programmingSchemas';
import { getCycleRows } from './cycleRowQuery';
import { getProgramCycleRowsByKeys, getProgramCycleYouthIds, type ProgramCycleKey } from '../programCycles/programCycleRowQuery';

export { getCycleReferenceData as getProgramCycles } from '../../referenceData/cycleReferenceData';

/**
 * Saves cycle metadata and replaces its program assignments in one transaction.
 * @param data - Validated date range, title, and complete set of unique program IDs.
 * @param user - User recorded on writes and used to scope response rows.
 * @param id - Existing cycle to update; omitted when creating.
 * @returns The saved cycle and affected rows.
 * @example setProgramCycle(data, user, cycleId) // update an existing cycle
 */
export async function setProgramCycle(data: SetProgramCycleInput, user: AccessTokenPayload, id?: string) {
  // 1. Update the cycle when an ID is supplied.
  if (id) return updateProgramCycleRecord(id, data, user);

  // 2. Check the selected programs.
  return sql.begin(async tx => {
    const trx = asTransactionSql(tx);
    const programs = await trx<{ id: string }[]>`
      SELECT id
      FROM programs
      WHERE id = ANY(${sql.array(data.programIds)}::uuid[])
      ORDER BY id
      FOR UPDATE
    `;
    if (programs.length !== data.programIds.length) throw new NotFoundError('One or more programs were not found');

    // 3. Save the cycle.
    const [cycle] = await trx<{ id: string }[]>`
      INSERT INTO program_cycles (title, starts_on, ends_on, created_by, updated_by)
      VALUES (${data.title}, ${data.startsOn}, ${data.endsOn}, ${user.userId}, ${user.userId})
      RETURNING id
    `;
    if (!cycle) throw new InternalServerError('Cycle creation returned no record');

    // 4. Assign the selected programs.
    const created = await trx<ProgramCycleKey[]>`
      INSERT INTO program_cycle_assignments (program_id, cycle_id, created_by, updated_by)
      SELECT program_id, ${cycle.id}, ${user.userId}, ${user.userId}
      FROM UNNEST(${sql.array(data.programIds)}::uuid[]) AS selected(program_id)
      RETURNING program_id, cycle_id
    `;

    // 5. Return the saved cycle and affected rows.
    return {
      cycle: await requireCycleRow(trx, cycle.id),
      updatedProgramCycles: user.permissions.includes('read:programs')
        ? await getProgramCycleRowsByKeys(trx, user, created) : [],
      createdProgramCycles: created,
      removedProgramCycles: [] as ProgramCycleKey[],
      updatedYouth: [],
    };
  }).catch(rethrowCycleConflict);
}

/**
 * Deletes a required unused cycle; missing cycles are 404 and existing dependencies are 409.
 * @param id - Cycle whose dependencies must be checked before deletion.
 * @example await deleteProgramCycle(cycleId) // deletes an unassigned cycle with no logged hours
 */
export async function deleteProgramCycle(id: string) {
  // 1. Find and lock the cycle.
  await sql.begin(async tx => {
    const trx = asTransactionSql(tx);
    const cycles = await trx`
      SELECT id
      FROM program_cycles
      WHERE id = ${id}
      FOR UPDATE
    `;
    if (!cycles.length) throw new NotFoundError('Cycle not found');

    // 2. Check whether the cycle is still in use.
    const dependencies = await trx`
      SELECT
        EXISTS (
          SELECT 1
          FROM program_cycle_assignments
          WHERE cycle_id = ${id}
        )
        OR EXISTS (
          SELECT 1
          FROM time_entries
          WHERE cycle_id = ${id}
        )
        AS in_use
    `;
    if (dependencies[0].inUse) {
      throw new ConflictError('Cycle cannot be deleted because it is still in use');
    }

    // 3. Delete the unused cycle.
    await trx`
      DELETE
      FROM program_cycles
      WHERE id = ${id}
    `;
  });
}

/**
 * Updates a cycle without removing used assignments or excluding existing sessions.
 * @param id - Required cycle to update.
 * @param data - Validated replacement dates, title, and assignments.
 * @param user - User recorded on writes and used to scope response rows.
 * @returns The saved cycle, assignment changes, and permission-gated program-cycle and youth rows.
 * @example updateProgramCycleRecord(cycleId, data, user) // update dates and assignments
 */
async function updateProgramCycleRecord(id: string, data: SetProgramCycleInput, user: AccessTokenPayload) {
  // 1. Check the selected programs.
  return sql.begin(async tx => {
    const trx = asTransactionSql(tx);

    // Both directions of assignment editing acquire programs before cycles and assignments.
    const programs = await trx<{ id: string }[]>`
      SELECT id
      FROM programs
      ORDER BY id
      FOR UPDATE
    `;
    if (data.programIds.some(programId => !programs.some(program => program.id === programId))) {
      throw new NotFoundError('One or more programs were not found');
    }

    // 2. Find and lock the cycle.
    const cycle = await trx`
      SELECT id
      FROM program_cycles
      WHERE id = ${id}
      FOR UPDATE
    `;
    if (!cycle.length) throw new NotFoundError('Cycle not found');

    // 3. Check the assignments being removed.
    const current = await trx<ProgramCycleKey[]>`
      SELECT program_id, cycle_id
      FROM program_cycle_assignments
      WHERE cycle_id = ${id}
      ORDER BY program_id
      FOR UPDATE
    `;
    const removed = current.filter(programCycle => !data.programIds.includes(programCycle.programId));
    for (const programCycle of removed) {
      await assertAssignmentUnused(trx, programCycle.programId, programCycle.cycleId);
    }

    // 4. Check that the dates still include existing sessions.
    const sessionsOutsideDates = await trx`
      SELECT 1
      FROM program_sessions session
      JOIN programs program ON program.id = session.program_id
      WHERE session.cycle_id = ${id}
        AND (session.date < ${data.startsOn}::date
          OR session.date > ${data.endsOn}::date)
      LIMIT 1
    `;
    if (sessionsOutsideDates.length) throw new ConflictError('Cycle dates must contain all existing sessions');

    // 5. Save the cycle and its program assignments.
    await trx`
      UPDATE program_cycles
      SET title = ${data.title},
        starts_on = ${data.startsOn},
        ends_on = ${data.endsOn},
        updated_at = NOW(),
        updated_by = ${user.userId}
      WHERE id = ${id}
    `;
    for (const programCycle of removed) {
      await trx`
        DELETE
        FROM program_cycle_assignments
        WHERE program_id = ${programCycle.programId}
          AND cycle_id = ${programCycle.cycleId}
      `;
    }
    const created = await trx<ProgramCycleKey[]>`
      INSERT INTO program_cycle_assignments (program_id, cycle_id, created_by, updated_by)
      SELECT program_id, ${id}, ${user.userId}, ${user.userId}
      FROM UNNEST(${sql.array(data.programIds)}::uuid[]) AS selected(program_id)
      ON CONFLICT (program_id, cycle_id) DO NOTHING
      RETURNING program_id, cycle_id
    `;
    const retained = current.filter(programCycle => data.programIds.includes(programCycle.programId));
    const affectedProgramCycles = [...retained, ...created];

    // 6. Return the saved cycle and affected rows.
    let updatedYouth: YouthRow[] = [];
    if (user.permissions.includes('read:youth_profiles')) {
      const youthIds = await getProgramCycleYouthIds(trx, affectedProgramCycles);
      updatedYouth = await getYouthRows(trx`youth.id = ANY(${trx.array(youthIds)}::uuid[])`, trx);
    }

    return {
      cycle: await requireCycleRow(trx, id),
      updatedProgramCycles: user.permissions.includes('read:programs')
        ? await getProgramCycleRowsByKeys(trx, user, affectedProgramCycles) : [],
      createdProgramCycles: created,
      removedProgramCycles: removed,
      updatedYouth,
    };
  }).catch(rethrowCycleConflict);
}

/**
 * Reads a cycle saved in the caller's transaction; an absent result is an internal failure.
 * @param trx - Transaction containing the successful cycle write.
 * @param id - Cycle just inserted or updated while locked.
 * @example await requireCycleRow(trx, cycleId) // returns the saved cycle with its computed state
 */
async function requireCycleRow(trx: typeof sql, id: string) {
  // 1. Load the saved cycle.
  const [cycle] = await getCycleRows(trx`cycle.id = ${id}`, trx);
  if (!cycle) throw new InternalServerError('Saved cycle record is unavailable');
  return cycle;
}

/**
 * Reports duplicate cycle titles and overlapping enrolled programs as conflicts.
 * Other failures retain their original identity.
 * @example rethrowCycleConflict(new Error('Disconnected')) // throws the same Error instance
 */
function rethrowCycleConflict(error: unknown): never {
  // 1. Report duplicate cycle titles.
  if (isUniqueViolation(error, 'program_cycles_title_key')) {
    throw Object.assign(new ConflictError('A cycle with this title already exists'), { cause: error });
  }
  rethrowEnrollmentConflict(error);
}
