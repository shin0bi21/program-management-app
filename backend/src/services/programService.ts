import { asTransactionSql, sql } from '../db/client';
import { ConflictError, NotFoundError, InternalServerError, isUniqueViolation } from '../errors';
import { programAccessPredicate } from '../policies/programAccessPolicy';
import type { AccessTokenPayload } from '../types/auth';
import type { CreateProgramInput, UpdateProgramInput } from '../validation/programSchemas';
import { getProgramCycleRowsByKeys, getProgramCycleYouthIds, type ProgramCycleKey } from './programming/programCycles/programCycleRecordQuery';
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
  `.catch(rethrowProgramConflict);
  if (!rows[0]) throw new InternalServerError('Program creation returned no record');
  return { program: rows[0], updatedProgramCycles: [], removedProgramCycles: [], createdProgramCycles: [] };
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
    if (!program) throw new InternalServerError('Program update returned no record');

    const keys = await trx<ProgramCycleKey[]>`SELECT program_id, cycle_id FROM program_cycle_assignments WHERE program_id = ${id} ORDER BY cycle_id`;
    const updatedProgramCycles = actor.permissions.includes('read:programs')
      ? await getProgramCycleRowsByKeys(trx, actor, keys) : [];
    const updatedYouth = actor.permissions.includes('read:youth_profiles')
      ? await getYouthRowsByIds(trx, await getProgramCycleYouthIds(trx, keys)) : [];

    return { program, updatedProgramCycles, removedProgramCycles: [], createdProgramCycles: [], updatedYouth };
  }).catch(rethrowProgramConflict);
}

/**
 * Adds domain context only for the program-name constraint; other failures propagate.
 * @example rethrowProgramConflict(error) // duplicate name becomes a contextual 409
 */
function rethrowProgramConflict(error: unknown): never {
  if (isUniqueViolation(error, 'programs_name_key')) {
    throw new ConflictError('A program with this name already exists', error);
  }
  throw error;
}
