import { asTransactionSql, sql } from '../db/client';
import { ConflictError, NotFoundError, InternalServerError, isUniqueViolation } from '../errors';
import { programAccessPredicate } from '../policies/programAccessPolicy';
import { rethrowEnrollmentConflict } from './programming/programCycles/enrollmentConflict';
import type { AccessTokenPayload } from '../types/auth';
import type { CreateProgramInput, UpdateProgramInput } from '../validation/programSchemas';
import { getProgramCycleRowsByKeys, getProgramCycleYouthIds, type ProgramCycleKey } from './programming/programCycles/programCycleRowQuery';
import { getYouthRows, type YouthRow } from './youth/youthRowQuery';
import { getProgramRows, programRowColumns, type ProgramRow } from './programming/programs/programRowQuery';

/**
 * Lists all program lookup rows by title, optionally restricted to the actor's program scope.
 * @param actor - Actor whose program scope applies when assignedOnly is true.
 * @param assignedOnly - Whether to limit results to programs the actor can access.
 * @example await getPrograms(assignedStaff, true) // Only programs assigned to this staff member.
 */
export function getPrograms(actor: AccessTokenPayload, assignedOnly = false) {
  // 1. Load matching programs.
  return sql<ProgramRow[]>`
    ${getProgramRows(assignedOnly ? programAccessPredicate(actor, sql`p.id`) : sql`TRUE`)}
    ORDER BY title ASC
  `;
}

/**
 * Creates a program and returns its row with empty assignment changes; duplicate titles are 409.
 * The caller must authorize program creation before calling.
 * @param data - Validated program settings; the title is trimmed before storage.
 * @example await createProgram({ ...validatedSettings, title: ' Leadership ' }) // program.title is 'Leadership'.
 */
export async function createProgram(data: CreateProgramInput) {
  // 1. Check the program title.
  const title = data.title.trim();
  const existing = await sql<{ id: string }[]>`
    SELECT id
    FROM programs
    WHERE LOWER(title) = LOWER(${title})
    LIMIT 1
  `;
  if (existing.length) throw new ConflictError('A program with this title already exists');

  // 2. Save the program.
  const rows = await sql<ProgramRow[]>`
    INSERT INTO programs AS p (title, description, enrollment_required, min_age, max_age, default_day_of_week, default_start_time, default_end_time, timezone)
    VALUES (
      ${title},
      ${data.description ?? null},
      ${data.enrollmentRequired},
      ${data.minAge ?? null},
      ${data.maxAge ?? null},
      ${data.defaultDayOfWeek}, ${data.defaultStartTime}, ${data.defaultEndTime}, ${data.timezone}
    )
    RETURNING ${programRowColumns}
  `.catch(rethrowProgramConflict);
  if (!rows[0]) throw new InternalServerError('Program creation returned no record');
  return { program: rows[0], updatedProgramCycles: [], removedProgramCycles: [], createdProgramCycles: [] };
}

/**
 * Replaces program settings and reads affected program-cycle and youth rows in one transaction.
 * The caller must authorize the write; missing programs are 404 and duplicate titles are 409.
 * @param id - Program to lock and update.
 * @param data - Validated replacement settings.
 * @param actor - Actor whose permissions determine related response rows.
 * @returns The saved program and related rows gated by the actor's read permissions.
 * @example await updateProgram(programId, { ...validatedSettings, title: 'Leadership' }, writeOnlyActor) // Related row arrays are empty.
 */
export async function updateProgram(id: string, data: UpdateProgramInput, actor: AccessTokenPayload) {
  return sql.begin(async tx => {
    const trx = asTransactionSql(tx);

    // 1. Lock the program.
    const [current] = await trx<{ id: string; enrollmentRequired: boolean }[]>`
      SELECT id, enrollment_required
      FROM programs
      WHERE id = ${id}
      FOR UPDATE
    `;
    if (!current) throw new NotFoundError('Program not found');

    // 2. Check the program title.
    const title = data.title.trim();
    const existing = await trx<{ id: string }[]>`
      SELECT id
      FROM programs
      WHERE LOWER(title) = LOWER(${title}) AND id != ${id}
      LIMIT 1
    `;
    if (existing.length) throw new ConflictError('A program with this title already exists');

    // 3. Lock affected cycles in a shared order before changing enrollment mode.
    if (current.enrollmentRequired !== data.enrollmentRequired) {
      await trx`
        SELECT cycle.id
        FROM program_cycles cycle
        WHERE EXISTS (
          SELECT 1
          FROM program_enrollments enrollment
          WHERE enrollment.program_id = ${id} AND enrollment.cycle_id = cycle.id
        )
        ORDER BY cycle.id
        FOR NO KEY UPDATE
      `;
    }

    // 4. Save the program settings.
    const [program] = await trx<ProgramRow[]>`
      UPDATE programs AS p
      SET title = ${title},
          description = ${data.description ?? null},
          enrollment_required = ${data.enrollmentRequired},
          min_age = ${data.minAge ?? null},
          max_age = ${data.maxAge ?? null},
          default_day_of_week = ${data.defaultDayOfWeek},
          default_start_time = ${data.defaultStartTime},
          default_end_time = ${data.defaultEndTime},
          timezone = ${data.timezone}
      WHERE id = ${id}
      RETURNING ${programRowColumns}
    `;
    if (!program) throw new InternalServerError('Program update returned no record');

    // 5. Return the affected rows.
    const keys = await trx<ProgramCycleKey[]>`
      SELECT program_id, cycle_id
      FROM program_cycle_assignments
      WHERE program_id = ${id}
      ORDER BY cycle_id
    `;
    const updatedProgramCycles = actor.permissions.includes('read:programs')
      ? await getProgramCycleRowsByKeys(trx, actor, keys) : [];
    let updatedYouth: YouthRow[] = [];
    if (actor.permissions.includes('read:youth_profiles')) {
      const youthIds = await getProgramCycleYouthIds(trx, keys);
      updatedYouth = await getYouthRows(trx`youth.id = ANY(${trx.array(youthIds)}::uuid[])`, trx);
    }

    return { program, updatedProgramCycles, removedProgramCycles: [], createdProgramCycles: [], updatedYouth };
  }).catch(rethrowProgramConflict);
}

/**
 * Reports duplicate titles and enrollment conflicts caused by program mode changes.
 * Other failures propagate unchanged.
 * @param error - Database or transaction failure to rethrow, retaining the original cause for duplicates.
 * @example rethrowProgramConflict(Object.assign(new Error('duplicate'), { code: '23505', constraint_name: 'programs_title_key' })) // Throws a contextual 409.
 */
function rethrowProgramConflict(error: unknown): never {
  if (isUniqueViolation(error, 'programs_title_key')) {
    throw Object.assign(new ConflictError('A program with this title already exists'), { cause: error });
  }
  rethrowEnrollmentConflict(error);
}
