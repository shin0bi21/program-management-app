import { asTransactionSql, sql } from '../../../db/client';
import { ConflictError, NotFoundError } from '../../../errors';
import { assertCanAccessCohort, assertCanAccessProgram } from '../../../policies/programAccessPolicy';
import type { AccessTokenPayload } from '../../../types/auth';
import type { CreateCohortInput, SetProgramCycleInput, UpdateCohortInput } from '../../../validation/cohortSchemas';

export async function createCohort(data: CreateCohortInput, actor: AccessTokenPayload) {
  await assertCanAccessProgram(actor, data.programId);
  const rows = await sql`
    INSERT INTO program_cohorts (
      program_id, cycle_id, created_by, updated_by
    )
    VALUES (
      ${data.programId}, ${data.cycleId}, ${actor.userId}, ${actor.userId}
    )
    RETURNING
      id,
      program_id,
      cycle_id,
      (SELECT name FROM program_cycles WHERE id = ${data.cycleId}) AS name,
      (SELECT name FROM program_cycles WHERE id = ${data.cycleId}) AS cycle_name,
      (SELECT starts_on::text FROM program_cycles WHERE id = ${data.cycleId}) AS starts_on,
      (SELECT ends_on::text FROM program_cycles WHERE id = ${data.cycleId}) AS ends_on,
      (SELECT roster_mode FROM programs WHERE id = ${data.programId}) AS roster_mode,
      (SELECT min_age FROM programs WHERE id = ${data.programId}) AS min_age,
      (SELECT max_age FROM programs WHERE id = ${data.programId}) AS max_age
  `;
  return rows[0];
}

export async function updateCohort(id: string, data: UpdateCohortInput, actor: AccessTokenPayload) {
  await assertCanAccessCohort(actor, id);
  const sessionsOutsideCycle = await sql`
    SELECT 1
    FROM cohort_sessions session
    INNER JOIN program_cycles cycle ON cycle.id = ${data.cycleId}
    WHERE session.cohort_id = ${id}
      AND (
        (session.starts_at AT TIME ZONE 'America/Toronto')::date < cycle.starts_on
        OR (session.ends_at AT TIME ZONE 'America/Toronto')::date > cycle.ends_on
      )
    LIMIT 1
  `;
  if (sessionsOutsideCycle.length) {
    throw new ConflictError('Cohort cycle must contain all existing sessions');
  }
  const rows = await sql`
    UPDATE program_cohorts
    SET cycle_id = ${data.cycleId},
        updated_at = NOW(), updated_by = ${actor.userId}
    WHERE id = ${id}
    RETURNING id
  `;
  if (!rows.length) throw new NotFoundError('Cohort not found');
  return rows[0];
}

export async function deleteCohort(id: string, actor: AccessTokenPayload) {
  await assertCanAccessCohort(actor, id);
  await sql.begin(async tx => {
    const trx = asTransactionSql(tx);
    const cohorts = await trx`SELECT id FROM program_cohorts WHERE id = ${id} FOR UPDATE`;
    if (!cohorts.length) throw new NotFoundError('Cohort not found');
    const attendance = await trx`
      SELECT 1 FROM attendance_records ar
      INNER JOIN cohort_sessions cs ON cs.id = ar.session_id
      WHERE cs.cohort_id = ${id} LIMIT 1
    `;
    if (attendance.length) {
      throw new ConflictError('Cohort cannot be deleted because one or more sessions have attendance');
    }
    const notes = await trx`
      SELECT 1 FROM session_notes sn
      INNER JOIN cohort_sessions cs ON cs.id = sn.session_id
      WHERE cs.cohort_id = ${id} LIMIT 1
    `;
    if (notes.length) {
      throw new ConflictError('Cohort cannot be deleted because one or more sessions have notes');
    }
    await trx`DELETE FROM cohort_enrollments WHERE cohort_id = ${id}`;
    await trx`DELETE FROM program_cohorts WHERE id = ${id}`;
  });
}

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
