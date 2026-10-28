import { asTransactionSql, sql } from '../../../db/client';
import { ConflictError, NotFoundError } from '../../../errors';
import { assertAssignmentUnused } from '../cohorts/assignmentService';
import type { AccessTokenPayload } from '../../../types/auth';
import type { SetProgramCycleInput } from '../../../validation/cohortSchemas';

export function getProgramCycles() {
  return sql<Array<{ id: string; name: string; startsOn: string; endsOn: string; state: 'active' | 'upcoming' | 'completed' }>>`
    SELECT id, name, starts_on::text AS starts_on, ends_on::text AS ends_on,
      CASE WHEN CURRENT_DATE < starts_on THEN 'upcoming' WHEN CURRENT_DATE > ends_on THEN 'completed' ELSE 'active' END AS state
    FROM program_cycles
    ORDER BY starts_on DESC, name, id
  `;
}

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
      RETURNING id, name, starts_on::text AS starts_on, ends_on::text AS ends_on
    `;
    await trx`
      INSERT INTO program_cohorts (program_id, cycle_id, created_by, updated_by)
      SELECT program_id, ${cycle.id}, ${actor.userId}, ${actor.userId}
      FROM UNNEST(${sql.array(data.programIds)}::uuid[]) AS selected(program_id)
    `;
    return cycle;
  });
}

export async function deleteProgramCycle(id: string) {
  await sql.begin(async tx => {
    const trx = asTransactionSql(tx);
    const cycles = await trx`SELECT id FROM program_cycles WHERE id = ${id} FOR UPDATE`;
    if (!cycles.length) throw new NotFoundError('Cycle not found');

    const dependencies = await trx`
      SELECT
        EXISTS (SELECT 1 FROM program_cohorts WHERE cycle_id = ${id})
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
    const current = await trx<{ id: string; programId: string }[]>`
      SELECT id, program_id FROM program_cohorts WHERE cycle_id = ${id} ORDER BY id FOR UPDATE
    `;
    const removed = current.filter(cohort => !data.programIds.includes(cohort.programId));
    for (const cohort of removed) {
      await assertAssignmentUnused(trx, cohort.id);
    }

    const sessionsOutsideDates = await trx`
      SELECT 1 FROM cohort_sessions session
      JOIN program_cohorts cohort ON cohort.id = session.cohort_id
      JOIN programs program ON program.id = cohort.program_id
      WHERE cohort.cycle_id = ${id}
        AND ((session.starts_at AT TIME ZONE program.timezone::text)::date < ${data.startsOn}::date
          OR (session.ends_at AT TIME ZONE program.timezone::text)::date > ${data.endsOn}::date)
      LIMIT 1
    `;
    if (sessionsOutsideDates.length) throw new ConflictError('Cycle dates must contain all existing sessions');

    const [updated] = await trx`
      UPDATE program_cycles
      SET name = ${data.name}, starts_on = ${data.startsOn}, ends_on = ${data.endsOn}, updated_at = NOW(), updated_by = ${actor.userId}
      WHERE id = ${id}
      RETURNING id, name, starts_on::text AS starts_on, ends_on::text AS ends_on
    `;
    for (const cohort of removed) {
      await trx`DELETE FROM program_cohorts WHERE id = ${cohort.id}`;
    }
    await trx`
      INSERT INTO program_cohorts (program_id, cycle_id, created_by, updated_by)
      SELECT program_id, ${id}, ${actor.userId}, ${actor.userId}
      FROM UNNEST(${sql.array(data.programIds)}::uuid[]) AS selected(program_id)
      ON CONFLICT (program_id, cycle_id) DO NOTHING
    `;
    return updated;
  });
}
