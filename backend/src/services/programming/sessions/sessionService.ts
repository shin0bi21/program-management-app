import { SESSION_TYPES } from '../../../types/programming';
import { asTransactionSql, sql } from '../../../db/client';
import { ConflictError, NotFoundError, InternalServerError, isUniqueViolation } from '../../../errors';
import { assertProgramCycleAccess, assertProgramAccess, assertSessionAccess } from '../../../policies/programAccessPolicy';
import { lockAssignmentProgram } from '../programCycles/assignmentService';
import { getSessionRows } from './sessionRowQuery';
import { buildSessionFilters } from './sessionRowFilters';
import { getProgramCycleRowsByKeys, type ProgramCycleKey } from '../programCycles/programCycleRowQuery';
import type { AccessTokenPayload } from '../../../types/auth';
import type {
  CreateSessionInput,
  UpdateSessionInput,
} from '../../../validation/programmingSchemas';

interface ProgramSchedule {
  defaultStartTime: string;
  defaultEndTime: string;
  nextDate: string;
}

/**
 * Lists fixed session type values and labels alphabetically.
 * @example await getSessionTypes() // [{ id: 'Field Trip', name: 'Field Trip' }, ...]
 */
export function getSessionTypes() {
  return [...SESSION_TYPES].sort().map(value => ({ id: value, name: value }));
}

/**
 * Creates a scheduled session in the one cycle covering its date; ambiguous assignments are 409.
 * @param programId - Program the user must be allowed to access.
 * @param data - Validated session settings, with optional schedule defaults.
 * @param user - User used for authorization and write metadata.
 * @returns The created session and any readable affected program-cycle rows after commit.
 * @example await createProgramSession(programId, { sessionType, title: 'Cooking', date: '2027-01-15' }, user) // session in the cycle covering January 15
 */
export async function createProgramSession(programId: string, data: CreateSessionInput, user: AccessTokenPayload) {
  // 1. Check access to the program.
  await assertProgramAccess(user, programId);
  return sql.begin(async tx => {
    const trx = asTransactionSql(tx);

    // 2. Lock the program before resolving cycle assignments.
    await lockAssignmentProgram(trx, programId, user);

    // 3. Load program defaults and resolve the session date.
    const schedule = await getProgramSchedule(programId, trx);
    const date = data.date ?? schedule.nextDate;

    // 4. Lock assigned cycles covering the session date.
    const assignments = await trx<ProgramCycleKey[]>`
      SELECT assignment.program_id, assignment.cycle_id
      FROM program_cycle_assignments assignment
      INNER JOIN program_cycles cycle ON cycle.id = assignment.cycle_id
      WHERE assignment.program_id = ${programId}
        AND ${date}::date BETWEEN cycle.starts_on AND cycle.ends_on
      ORDER BY cycle.id
      FOR UPDATE OF cycle, assignment
    `;
    if (!assignments.length) {
      throw new ConflictError('No assigned cycle covers this session date. Assign a cycle covering this date in Programming settings.');
    }
    if (assignments.length > 1) {
      throw new ConflictError('Multiple assigned cycles cover this session date. Adjust the overlapping cycle dates in Programming settings.');
    }

    // 5. Save the session and return affected cycle rows.
    return createScheduledSession(trx, programId, assignments[0].cycleId, data, user, schedule, date);
  }).catch(rethrowSessionConflict);
}

/**
 * Creates a session in a required program-cycle assignment; dates outside that cycle are 409.
 * @param programId - Program owning the session.
 * @param cycleId - Assigned cycle the user must be allowed to access.
 * @param data - Validated session settings, with optional schedule defaults.
 * @param user - User used for authorization and write metadata.
 * @returns The created session and any readable affected program-cycle rows after commit.
 * @example await createSession(programId, cycleId, { sessionType, title: 'Cooking', date: '2027-01-15' }, user) // January 15 session using program default times
 */
export async function createSession(programId: string, cycleId: string, data: CreateSessionInput, user: AccessTokenPayload) {

  // 1. Check access to the assigned program and cycle.
  await assertProgramCycleAccess(user, programId, cycleId);
  return sql.begin(async tx => {
    const trx = asTransactionSql(tx);

    // 2. Lock the program, cycle, and assignment.
    await lockSessionAssignment(trx, programId, cycleId, user);

    // 3. Load the cycle date bounds.
    const [cycle] = await trx<{ startsOn: string; endsOn: string }[]>`
      SELECT cycle.starts_on, cycle.ends_on
      FROM program_cycles cycle
      WHERE cycle.id = ${cycleId}
    `;

    if (!cycle) throw new InternalServerError('Locked cycle record is unavailable');

    // 4. Resolve the session date from program defaults.
    const schedule = await getProgramSchedule(programId, trx);
    const date = data.date ?? schedule.nextDate;
    if (date < cycle.startsOn || date > cycle.endsOn) {
      throw new ConflictError('Sessions must fall within the cycle date range');
    }

    // 5. Save the session within the validated cycle.
    return createScheduledSession(trx, programId, cycleId, data, user, schedule, date);
  }).catch(rethrowSessionConflict);
}

/**
 * Updates an accessible session; missing targets are 404 and dates outside its cycle are 409.
 * @param id - Session the user must be allowed to access.
 * @param data - Validated replacement session fields.
 * @param user - User used for authorization, write metadata, and response scope.
 * @example await updateSession(sessionId, { title: 'Cooking', date: '2027-01-15', startTime: '17:00', endTime: '18:00' }, user) // returns the saved session with its existing type and cleared description
 */
export async function updateSession(id: string, data: UpdateSessionInput, user: AccessTokenPayload) {

  // 1. Check access to the session.
  await assertSessionAccess(user, id);
  return sql.begin(async tx => {
    const trx = asTransactionSql(tx);

    // 2. Find the session assignment.
    const [session] = await trx<ProgramCycleKey[]>`
      SELECT program_id, cycle_id
      FROM program_sessions
      WHERE id = ${id}
    `;
    if (!session) throw new NotFoundError('Session not found');

    // 3. Lock the program, cycle, and assignment.
    await lockSessionAssignment(trx, session.programId, session.cycleId, user);

    // 4. Validate the replacement date against the locked cycle.
    const [cycle] = await trx<{ startsOn: string; endsOn: string }[]>`
      SELECT starts_on, ends_on
      FROM program_cycles
      WHERE id = ${session.cycleId}
    `;
    if (!cycle) throw new InternalServerError('Locked cycle record is unavailable');
    if (data.date < cycle.startsOn || data.date > cycle.endsOn) {
      throw new ConflictError('Sessions must fall within the cycle date range');
    }

    // 5. Save the replacement session details.
    const rows = await trx`
      UPDATE program_sessions
      SET session_type = COALESCE(${data.sessionType ?? null}, session_type),
          title = ${data.title},
          date = ${data.date}, start_time = ${data.startTime}, end_time = ${data.endTime},
          description = ${data.description ?? null}, updated_at = NOW(), updated_by = ${user.userId}
      WHERE id = ${id}
      RETURNING id
    `;
    if (!rows.length) throw new NotFoundError('Session not found');

    // 6. Load the complete saved session for the response.
    const [saved] = await buildSessionFilters(getSessionRows(user, trx), { ids: [id] }, trx);
    if (!saved) throw new InternalServerError('Saved session record is unavailable');

    // 7. Load affected cycle rows and return them with the updated session.
    return { session: saved, updatedProgramCycles: await getUpdatedProgramCycles(user, [saved], trx) };
  }).catch(rethrowSessionConflict);
}

/**
 * Moves a session between future dates while preserving clock times and recorded history.
 * @param id - Accessible, non-cancelled session to move.
 * @param date - Authoritative YYYY-MM-DD destination, strictly after today.
 * @param user - User used for authorization, write metadata, and response scope.
 * @example await moveSessionDate(sessionId, '2030-03-10', user) // preserves both saved clock times
 */
export async function moveSessionDate(id: string, date: string, user: AccessTokenPayload) {

  // 1. Check access to the session.
  await assertSessionAccess(user, id);
  return sql.begin(async tx => {
    const trx = asTransactionSql(tx);

    // 2. Find the session program.
    const [lookup] = await trx<{ programId: string }[]>`
      SELECT session.program_id
      FROM program_sessions session
      WHERE session.id = ${id}
    `;
    if (!lookup) throw new NotFoundError('Session not found');

    // 3. Lock the program before resolving the destination cycle.
    await lockAssignmentProgram(trx, lookup.programId, user);

    // 4. Lock the session and check its saved date against today's date.
    const [session] = await trx<{
      cycleId: string; movable: boolean; today: string;
    }[]>`
      SELECT cycle_id,
        cancelled_at IS NULL
          AND date > CURRENT_DATE AS movable,
        CURRENT_DATE AS today
      FROM program_sessions
      WHERE id = ${id}
      FOR UPDATE
    `;
    if (!session) throw new NotFoundError('Session not found');
    if (!session.movable) throw new ConflictError('Only non-cancelled sessions on future dates can be moved');
    if (date <= session.today) throw new ConflictError('Session destination must be after today');

    // 5. Lock assigned cycles covering the destination date.
    const assignments = await trx<ProgramCycleKey[]>`
      SELECT assignment.program_id, assignment.cycle_id
      FROM program_cycle_assignments assignment
      JOIN program_cycles cycle ON cycle.id = assignment.cycle_id
      WHERE assignment.program_id = ${lookup.programId}
        AND ${date}::date BETWEEN cycle.starts_on AND cycle.ends_on
      ORDER BY cycle.id
      FOR UPDATE OF cycle, assignment
    `;
    if (!assignments.length) throw new ConflictError('No assigned cycle covers this session date');
    if (assignments.length > 1) throw new ConflictError('Multiple assigned cycles cover this session date');

    // 6. Reject a cycle change when the session has recorded data.
    if (assignments[0].cycleId !== session.cycleId) {
      const [records] = await trx<{ recorded: boolean }[]>`
        SELECT EXISTS (SELECT 1
        FROM attendance_records
        WHERE session_id = ${id})
          OR EXISTS (
            SELECT 1
            FROM session_notes
            WHERE session_id = ${id}
          )
          OR EXISTS (
            SELECT 1
            FROM session_attachments
            WHERE session_id = ${id}
          )
          OR EXISTS (
            SELECT 1
            FROM time_entries
            WHERE session_id = ${id}
          ) AS recorded
      `;
      if (records.recorded) throw new ConflictError('Sessions with recorded data cannot move to a different cycle');
    }

    // 7. Save only the destination date and resolved cycle, retaining both times.
    await trx`
      UPDATE program_sessions
      SET cycle_id = ${assignments[0].cycleId},
        date = ${date},
        updated_at = NOW(), updated_by = ${user.userId}
      WHERE id = ${id}
      RETURNING id
    `;

    // 8. Load the complete moved session for the response.
    const [saved] = await buildSessionFilters(getSessionRows(user, trx), { ids: [id] }, trx);
    if (!saved) throw new InternalServerError('Saved session record is unavailable');

    // 9. Load affected cycle rows and return them with the moved session.
    return { session: saved, updatedProgramCycles: await getUpdatedProgramCycles(user, [{ programId: lookup.programId, cycleId: session.cycleId }, saved], trx) };
  }).catch(rethrowSessionConflict);
}

/**
 * Deletes an accessible session without attendance, notes, attachments, or logged hours; dependencies are 409.
 * @param id - Required session to delete.
 * @param user - User whose session access and response scope are enforced.
 * @example await deleteSession(sessionId, user) // removes an unrecorded session and returns { id: sessionId, updatedProgramCycles }
 */
export async function deleteSession(id: string, user: AccessTokenPayload) {
  // 1. Check access to the session.
  await assertSessionAccess(user, id);
  return sql.begin(async tx => {
    const trx = asTransactionSql(tx);

    // 2. Find the session assignment.
    const [lookup] = await trx<ProgramCycleKey[]>`
      SELECT program_id, cycle_id
      FROM program_sessions
      WHERE id = ${id}
    `;
    if (!lookup) throw new NotFoundError('Session not found');

    // 3. Lock the program, cycle, and assignment.
    await lockSessionAssignment(trx, lookup.programId, lookup.cycleId, user);

    // 4. Lock the session before checking deletion dependencies.
    const [session] = await trx<ProgramCycleKey[]>`
      SELECT program_id, cycle_id
      FROM program_sessions
      WHERE id = ${id}
      FOR UPDATE
    `;
    if (!session) throw new NotFoundError('Session not found');

    // 5. Reject sessions with recorded attendance.
    const attendance = await trx`
      SELECT 1
      FROM attendance_records
      WHERE session_id = ${id}
      LIMIT 1
    `;
    if (attendance.length) {
      throw new ConflictError('Session cannot be deleted because attendance has been recorded');
    }

    // 6. Reject sessions with recorded notes.
    const notes = await trx`
      SELECT 1
      FROM session_notes
      WHERE session_id = ${id}
      LIMIT 1
    `;
    if (notes.length) {
      throw new ConflictError('Session cannot be deleted because session notes have been recorded');
    }

    // 7. Reject sessions with attachments.
    const attachments = await trx`
      SELECT 1
      FROM session_attachments
      WHERE session_id = ${id}
      LIMIT 1
    `;
    if (attachments.length) {
      throw new ConflictError('Session cannot be deleted because attachments have been added');
    }

    // 8. Reject sessions with logged hours.
    const hours = await trx`
      SELECT 1
      FROM time_entries
      WHERE session_id = ${id}
      LIMIT 1
    `;
    if (hours.length) {
      throw new ConflictError('Session cannot be deleted because hours have been logged');
    }

    // 9. Delete the session after the dependency checks.
    await trx`
      DELETE
      FROM program_sessions
      WHERE id = ${id}
    `;

    // 10. Load affected cycle rows and return them with the deleted session ID.
    return { id, updatedProgramCycles: await getUpdatedProgramCycles(user, [session], trx) };
  });
}

/**
 * Locks a program, cycle, and required assignment in order; missing assignments are 404.
 * @param trx - Existing transaction owning all acquired locks.
 * @param programId - Program to authorize and lock first.
 * @param cycleId - Cycle whose assignment must remain present.
 * @param user - User whose program access must be enforced.
 * @example await lockSessionAssignment(trx, programId, cycleId, user) // an absent assignment throws 404; locks last until the transaction ends
 */
async function lockSessionAssignment(trx: typeof sql, programId: string, cycleId: string, user: AccessTokenPayload) {
  // 1. Authorize and lock the program.
  await lockAssignmentProgram(trx, programId, user);

  // 2. Lock the required cycle.
  await trx`
    SELECT id
    FROM program_cycles
    WHERE id = ${cycleId}
    FOR UPDATE
  `;

  // 3. Lock and require the program-cycle assignment.
  const assignments = await trx`
    SELECT program_id
    FROM program_cycle_assignments
    WHERE program_id = ${programId} AND cycle_id = ${cycleId}
    FOR UPDATE
  `;
  if (!assignments.length) throw new NotFoundError('Program cycle not found');
}

/**
 * Returns program clock defaults and the next default date; missing configuration is 500.
 * @param programId - Program whose defaults and current date/time are needed.
 * @param query - Defaults to the shared client; pass trx to join an existing transaction.
 * @example await getProgramSchedule(programId, trx) // nextDate is next Tuesday if today's default start has passed
 */
async function getProgramSchedule(programId: string, query = sql): Promise<ProgramSchedule> {
  // 1. Resolve today's program date, clock time, and weekday offset.
  const [schedule] = await query<ProgramSchedule[]>`
    WITH schedule AS (
      SELECT default_start_time, default_end_time,
        CURRENT_DATE AS today,
        LOCALTIME AS local_time,
        (
          array_position(ARRAY['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'], default_day_of_week)
          - 1 - EXTRACT(DOW FROM CURRENT_DATE)::integer + 7
        ) % 7 AS days_until_default
      FROM programs
      WHERE id = ${programId}
    )
    SELECT to_char(default_start_time, 'HH24:MI') AS default_start_time,
      to_char(default_end_time, 'HH24:MI') AS default_end_time,
      (
        today + days_until_default
          + CASE
              WHEN days_until_default = 0 AND local_time >= default_start_time THEN 7
              ELSE 0
            END
      ) AS next_date
    FROM schedule
  `;
  if (!schedule) throw new InternalServerError('Required program schedule is unavailable');
  return schedule;
}

/**
 * Creates one session from local schedule values and returns visible affected cycle rows.
 * @param trx - Existing transaction owning the session write.
 * @param programId - Program owning the session.
 * @param cycleId - Previously verified assigned cycle.
 * @param data - Validated session details and optional time overrides.
 * @param user - User recorded on writes and used to scope response rows.
 * @param schedule - Program clock defaults used when a request omits times.
 * @param date - Authoritative supplied date or resolved default YYYY-MM-DD date.
 * @example await createScheduledSession(trx, programId, cycleId, { sessionType, title: 'Cooking' }, user, schedule, '2027-01-15') // inserts January 15 using schedule defaults
 */
async function createScheduledSession(
  trx: typeof sql,
  programId: string,
  cycleId: string,
  data: CreateSessionInput,
  user: AccessTokenPayload,
  schedule: ProgramSchedule,
  date: string,
) {
  const startTime = data.startTime ?? schedule.defaultStartTime;
  const endTime = data.endTime ?? schedule.defaultEndTime;

  // 1. Validate clock ordering after resolving omitted program defaults.
  if (endTime <= startTime) throw new ConflictError('End time must be after start time');

  // 2. Insert the session using the resolved schedule.
  const [session] = await trx`
    INSERT INTO program_sessions (
      program_id, cycle_id, session_type, title, date, start_time, end_time, description, created_by, updated_by
    ) VALUES (
      ${programId}, ${cycleId}, ${data.sessionType}, ${data.title},
      ${date}, ${startTime}, ${endTime},
      ${data.description ?? null}, ${user.userId}, ${user.userId}
    )
    RETURNING id
  `;
  if (!session) throw new InternalServerError('Session creation returned no record');

  // 3. Load the complete created session for the response.
  const [saved] = await buildSessionFilters(getSessionRows(user, trx), { ids: [session.id] }, trx);
  if (!saved) throw new InternalServerError('Saved session record is unavailable');

  // 4. Load affected cycle rows and return them with the created session.
  return { ...saved, updatedProgramCycles: await getUpdatedProgramCycles(user, [{ programId, cycleId }], trx) };
}

/**
 * Returns affected cycle rows when the user can read programs; otherwise returns undefined.
 * @param user - User whose read permission and row scope apply.
 * @param keys - Program-cycle pairs affected by the session operation.
 * @param query - Defaults to the shared client; pass trx to join an existing transaction.
 * @example getUpdatedProgramCycles(sessionOnlyWriter, [{ programId, cycleId }], trx) // undefined without read:programs
 */
function getUpdatedProgramCycles(user: AccessTokenPayload, keys: ProgramCycleKey[], query = sql) {
  // 1. Load affected cycle rows only when the user can read programs.
  return user.permissions.includes('read:programs')
    ? getProgramCycleRowsByKeys(query, user, keys)
    : undefined;
}

/**
 * Adds context to duplicate session schedules without changing other failures.
 * @param error - Original transaction failure; only the duplicate schedule constraint is translated.
 * @example rethrowSessionConflict(new Error('offline')) // throws that same Error unchanged
 */
function rethrowSessionConflict(error: unknown): never {
  if (isUniqueViolation(error, 'uq_program_sessions_program_cycle_title_start')) {
    throw Object.assign(new ConflictError('A session with this title and start time already exists in this program cycle'), { cause: error });
  }
  throw error;
}
