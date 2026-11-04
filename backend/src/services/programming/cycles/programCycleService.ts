import { getYouthRowsByIds } from '../../youth/youthRecordQuery';
import { asTransactionSql, sql } from '../../../db/client';
import { ConflictError, NotFoundError } from '../../../errors';
import { assertAssignmentUnused } from '../programCycles/assignmentService';
import type { AccessTokenPayload } from '../../../types/auth';
import type { SetProgramCycleInput } from '../../../validation/programmingSchemas';
import { getCycleRow } from './cycleRecordQuery';
import { getProgramCycleRowsByKeys, getProgramCycleYouthIds, type ProgramCycleKey } from '../programCycles/programCycleRecordQuery';

export { getCycleReferenceData as getProgramCycles } from '../../referenceData/cycleReferenceData';

export async function setProgramCycle(data: SetProgramCycleInput, actor: AccessTokenPayload, id?: string) {
  if (id) return updateProgramCycleRecord(id, data, actor);
  return sql.begin(async tx => {
    const trx = asTransactionSql(tx);
    const programs = await trx<{ id: string }[]>`
      SELECT id FROM programs WHERE id = ANY(${sql.array(data.programIds)}::uuid[])
      ORDER BY id FOR UPDATE
    `;
    if (programs.length !== data.programIds.length) throw new NotFoundError('One or more programs were not found');

    const [cycle] = await trx<{ id: string }[]>`
      INSERT INTO program_cycles (name, starts_on, ends_on, created_by, updated_by)
      VALUES (${data.name}, ${data.startsOn}, ${data.endsOn}, ${actor.userId}, ${actor.userId})
      RETURNING id
    `;
    const created = await trx<ProgramCycleKey[]>`
      INSERT INTO program_cycle_assignments (program_id, cycle_id, created_by, updated_by)
      SELECT program_id, ${cycle.id}, ${actor.userId}, ${actor.userId}
      FROM UNNEST(${sql.array(data.programIds)}::uuid[]) AS selected(program_id)
      RETURNING program_id, cycle_id
    `;
    return {
      cycle: await getCycleRow(trx, cycle.id),
      updatedProgramCycles: actor.permissions.includes('read:programs')
        ? await getProgramCycleRowsByKeys(trx, actor, created) : [],
      createdProgramCycles: created,
      removedProgramCycles: [] as ProgramCycleKey[],
      updatedYouth: [],
    };
  });
}

export async function deleteProgramCycle(id: string) {
  await sql.begin(async tx => {
    const trx = asTransactionSql(tx);
    const cycles = await trx`SELECT id FROM program_cycles WHERE id = ${id} FOR UPDATE`;
    if (!cycles.length) throw new NotFoundError('Cycle not found');

    const dependencies = await trx`
      SELECT
        EXISTS (SELECT 1 FROM program_cycle_assignments WHERE cycle_id = ${id})
        OR EXISTS (SELECT 1 FROM time_entries WHERE cycle_id = ${id})
        AS in_use
    `;
    if (dependencies[0].inUse) {
      throw new ConflictError('Cycle cannot be deleted because it is still in use');
    }

    await trx`DELETE FROM program_cycles WHERE id = ${id}`;
  });
}

async function updateProgramCycleRecord(id: string, data: SetProgramCycleInput, actor: AccessTokenPayload) {
  return sql.begin(async tx => {
    const trx = asTransactionSql(tx);
    // Both directions of assignment editing acquire programs before cycles and assignments.
    const programs = await trx<{ id: string }[]>`SELECT id FROM programs ORDER BY id FOR UPDATE`;
    if (data.programIds.some(programId => !programs.some(program => program.id === programId))) {
      throw new NotFoundError('One or more programs were not found');
    }

    const cycle = await trx`SELECT id FROM program_cycles WHERE id = ${id} FOR UPDATE`;
    if (!cycle.length) throw new NotFoundError('Cycle not found');
    const current = await trx<ProgramCycleKey[]>`
      SELECT program_id, cycle_id FROM program_cycle_assignments WHERE cycle_id = ${id} ORDER BY program_id FOR UPDATE
    `;
    const removed = current.filter(programCycle => !data.programIds.includes(programCycle.programId));
    for (const programCycle of removed) {
      await assertAssignmentUnused(trx, programCycle.programId, programCycle.cycleId);
    }

    const sessionsOutsideDates = await trx`
      SELECT 1 FROM program_sessions session
      JOIN programs program ON program.id = session.program_id
      WHERE session.cycle_id = ${id}
        AND ((session.starts_at AT TIME ZONE program.timezone::text)::date < ${data.startsOn}::date
          OR (session.ends_at AT TIME ZONE program.timezone::text)::date > ${data.endsOn}::date)
      LIMIT 1
    `;
    if (sessionsOutsideDates.length) throw new ConflictError('Cycle dates must contain all existing sessions');

    await trx`
      UPDATE program_cycles
      SET name = ${data.name}, starts_on = ${data.startsOn}, ends_on = ${data.endsOn}, updated_at = NOW(), updated_by = ${actor.userId}
      WHERE id = ${id}
    `;
    for (const programCycle of removed) {
      await trx`DELETE FROM program_cycle_assignments WHERE program_id = ${programCycle.programId} AND cycle_id = ${programCycle.cycleId}`;
    }
    const created = await trx<ProgramCycleKey[]>`
      INSERT INTO program_cycle_assignments (program_id, cycle_id, created_by, updated_by)
      SELECT program_id, ${id}, ${actor.userId}, ${actor.userId}
      FROM UNNEST(${sql.array(data.programIds)}::uuid[]) AS selected(program_id)
      ON CONFLICT (program_id, cycle_id) DO NOTHING
      RETURNING program_id, cycle_id
    `;
    const retained = current.filter(programCycle => data.programIds.includes(programCycle.programId));
    return {
      cycle: await getCycleRow(trx, id),
      updatedProgramCycles: actor.permissions.includes('read:programs')
        ? await getProgramCycleRowsByKeys(trx, actor, [...retained, ...created]) : [],
      createdProgramCycles: created,
      removedProgramCycles: removed,
      updatedYouth: actor.permissions.includes('read:youth_profiles')
        ? await getYouthRowsByIds(trx, await getProgramCycleYouthIds(trx, [...retained, ...created])) : [],
    };
  });
}
