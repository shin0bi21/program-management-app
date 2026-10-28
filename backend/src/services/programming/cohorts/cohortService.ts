import { asTransactionSql, sql } from '../../../db/client';
import { ConflictError, NotFoundError } from '../../../errors';
import { assertCanAccessCohort } from '../../../policies/programAccessPolicy';
import { assertAssignmentUnused, lockAssignmentProgram } from './assignmentService';
import type { AccessTokenPayload } from '../../../types/auth';
import type { CreateCohortInput, UpdateCohortInput } from '../../../validation/cohortSchemas';

export async function createCohort(data: CreateCohortInput, actor: AccessTokenPayload) {
  return sql.begin(async tx => {
    const trx = asTransactionSql(tx);
    await lockAssignmentProgram(trx, data.programId, actor);

    const rows = await trx`
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
      (SELECT enrollment_required FROM programs WHERE id = ${data.programId}) AS enrollment_required,
      (SELECT min_age FROM programs WHERE id = ${data.programId}) AS min_age,
      (SELECT max_age FROM programs WHERE id = ${data.programId}) AS max_age
  `;
    return rows[0];
  });
}

export async function updateCohort(id: string, data: UpdateCohortInput, actor: AccessTokenPayload) {
  await assertCanAccessCohort(actor, id);
  return sql.begin(async tx => {
    const trx = asTransactionSql(tx);
    const [assignment] = await trx<{ programId: string }[]>`SELECT program_id FROM program_cohorts WHERE id = ${id}`;
    if (!assignment) throw new NotFoundError('Cohort not found');
    await lockAssignmentProgram(trx, assignment.programId, actor);

    const locked = await trx`SELECT id FROM program_cohorts WHERE id = ${id} FOR UPDATE`;
    if (!locked.length) throw new NotFoundError('Cohort not found');

    const sessionsOutsideCycle = await trx`
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
    const rows = await trx`
      UPDATE program_cohorts
      SET cycle_id = ${data.cycleId},
          updated_at = NOW(), updated_by = ${actor.userId}
      WHERE id = ${id}
      RETURNING id
    `;
    return rows[0];
  });
}

export async function deleteCohort(id: string, actor: AccessTokenPayload) {
  await assertCanAccessCohort(actor, id);
  await sql.begin(async tx => {
    const trx = asTransactionSql(tx);
    const [assignment] = await trx<{ programId: string }[]>`SELECT program_id FROM program_cohorts WHERE id = ${id}`;
    if (!assignment) throw new NotFoundError('Cohort not found');
    await lockAssignmentProgram(trx, assignment.programId, actor);

    const cohorts = await trx`SELECT id FROM program_cohorts WHERE id = ${id} FOR UPDATE`;
    if (!cohorts.length) throw new NotFoundError('Cohort not found');
    await assertAssignmentUnused(trx, id);
    await trx`DELETE FROM program_cohorts WHERE id = ${id}`;
  });
}
