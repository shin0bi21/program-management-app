import { asTransactionSql, sql } from '../../../db/client';
import { ConflictError, NotFoundError } from '../../../errors';
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
  const rows = await sql`
    INSERT INTO program_cycles (name, starts_on, ends_on, created_by, updated_by)
    VALUES (${data.name}, ${data.startsOn}, ${data.endsOn}, ${actor.userId}, ${actor.userId})
    RETURNING id, name, starts_on::text AS starts_on, ends_on::text AS ends_on
  `;
  return rows[0];
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
  const rows = await sql`
    UPDATE program_cycles
    SET name = ${data.name}, starts_on = ${data.startsOn}, ends_on = ${data.endsOn}, updated_at = NOW(), updated_by = ${actor.userId}
    WHERE id = ${id}
    RETURNING id, name, starts_on::text AS starts_on, ends_on::text AS ends_on
  `;
  if (!rows.length) throw new NotFoundError('Cycle not found');
  return rows[0];
}
