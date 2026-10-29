import { asTransactionSql, sql } from '../db/client';
import { ConflictError, NotFoundError } from '../errors';
import { programAccessPredicate } from '../policies/programAccessPolicy';
import type { AccessTokenPayload } from '../types/auth';
import type { CreateProgramInput, UpdateProgramInput } from '../validation/programSchemas';
import { getCohortRowsByIds, getCohortYouthIds } from './programming/cohorts/cohortRecordQuery';
import { getYouthRowsByIds } from './youth/youthRecordQuery';
import { programRecordColumns, type ProgramRow } from './programming/programs/programRecordQuery';

export function getPrograms(actor: AccessTokenPayload, assignedOnly = false) {
  return sql<ProgramRow[]>`
    SELECT ${programRecordColumns}
    FROM programs p
    WHERE ${assignedOnly ? programAccessPredicate(actor, sql`p.id`) : sql`TRUE`}
    ORDER BY name ASC
  `;
}

export async function createProgram(data: CreateProgramInput) {
  const name = data.name.trim();
  const existing = await sql<{ id: string }[]>`
    SELECT id FROM programs WHERE LOWER(name) = LOWER(${name}) LIMIT 1
  `;
  if (existing.length) throw new ConflictError('A program with this name already exists');

  const rows = await sql<ProgramRow[]>`
    INSERT INTO programs AS p (name, description, enrollment_required, min_age, max_age, default_day_of_week, default_start_time, default_end_time, timezone)
    VALUES (
      ${name},
      ${data.description ?? null},
      ${data.enrollmentRequired},
      ${data.minAge ?? null},
      ${data.maxAge ?? null},
      ${data.defaultDayOfWeek}, ${data.defaultStartTime}, ${data.defaultEndTime}, ${data.timezone}
    )
    RETURNING ${programRecordColumns}
  `;
  return { program: rows[0], updatedCohorts: [], removedCohortIds: [], createdCohortIds: [] };
}

export async function updateProgram(id: string, data: UpdateProgramInput, actor: AccessTokenPayload) {
  return sql.begin(async tx => {
    const trx = asTransactionSql(tx);
    const [current] = await trx<{ id: string }[]>`SELECT id FROM programs WHERE id = ${id} FOR UPDATE`;
    if (!current) throw new NotFoundError('Program not found');

    const name = data.name.trim();
    const existing = await trx<{ id: string }[]>`
      SELECT id FROM programs WHERE LOWER(name) = LOWER(${name}) AND id != ${id} LIMIT 1
    `;
    if (existing.length) throw new ConflictError('A program with this name already exists');

    const [program] = await trx<ProgramRow[]>`
      UPDATE programs AS p
      SET name = ${name},
          description = ${data.description ?? null},
          enrollment_required = ${data.enrollmentRequired},
          min_age = ${data.minAge ?? null},
          max_age = ${data.maxAge ?? null},
          default_day_of_week = ${data.defaultDayOfWeek},
          default_start_time = ${data.defaultStartTime},
          default_end_time = ${data.defaultEndTime},
          timezone = ${data.timezone}
      WHERE id = ${id}
      RETURNING ${programRecordColumns}
    `;
    const cohorts = await trx<{ id: string }[]>`SELECT id FROM program_cohorts WHERE program_id = ${id} ORDER BY id`;
    const cohortIds = cohorts.map(cohort => cohort.id);
    const updatedCohorts = actor.permissions.includes('read:programs')
      ? await getCohortRowsByIds(trx, actor, cohortIds) : [];
    const updatedYouth = actor.permissions.includes('read:youth_profiles')
      ? await getYouthRowsByIds(trx, await getCohortYouthIds(trx, cohortIds)) : [];

    return { program, updatedCohorts, removedCohortIds: [], createdCohortIds: [], updatedYouth };
  });
}
