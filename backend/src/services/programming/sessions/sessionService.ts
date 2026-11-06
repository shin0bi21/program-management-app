import { asTransactionSql, sql } from '../../../db/client';
import { ConflictError, NotFoundError, InternalServerError, isUniqueViolation } from '../../../errors';
import { assertCanAccessProgramCycle, assertCanAccessProgram, assertCanAccessSession } from '../../../policies/programAccessPolicy';
import { lockAssignmentProgram } from '../programCycles/assignmentService';
import { getSessionRowsByIds } from './sessionRecordQuery';
import { getProgramCycleRowsByKeys, type ProgramCycleKey } from '../programCycles/programCycleRecordQuery';
import type { AccessTokenPayload } from '../../../types/auth';
import type {
  CreateSessionInput,
  UpdateSessionInput,
} from '../../../validation/programmingSchemas';

const weekdayIndex = {
  sunday: 0,
  monday: 1,
  tuesday: 2,
  wednesday: 3,
  thursday: 4,
  friday: 5,
  saturday: 6,
} as const;

interface ProgramSchedule {
  defaultDayOfWeek: keyof typeof weekdayIndex;
  defaultStartTime: string;
  defaultEndTime: string;
  timezone: string;
  today: string;
  localTime: string;
}

/**
 * Lists session type IDs and names alphabetically.
 * @example await getSessionTypes() // [{ id: regularTypeId, name: 'Regular' }] when Regular is the only type
 */
export function getSessionTypes() {
  // 1. Load session types in name order.
  return sql`SELECT id, name FROM session_types ORDER BY name`;
}

/**
 * Creates a scheduled session in the one cycle covering its date; ambiguous assignments are 409.
 * @param programId - Program the actor must be allowed to access.
 * @param data - Validated session settings, with optional schedule defaults.
 * @param actor - Actor used for authorization and write metadata.
 * @returns The created session and any readable affected program-cycle rows after commit.
 * @example await createProgramSession(programId, { sessionTypeId, theme: 'Cooking', date: '2027-01-15' }, actor) // session in the cycle covering January 15
 */
export async function createProgramSession(programId: string, data: CreateSessionInput, actor: AccessTokenPayload) {
  // 1. Check access to the program.
  await assertCanAccessProgram(actor, programId);
  return sql.begin(async tx => {
    const trx = asTransactionSql(tx);

    // 2. Lock the program before resolving cycle assignments.
    await lockAssignmentProgram(trx, programId, actor);

    // 3. Load program defaults and resolve the session date.
    const schedule = await getProgramSchedule(trx, programId);
    const date = resolveSessionDate(data.date, schedule);

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
    return createScheduledSession(trx, programId, assignments[0].cycleId, data, actor, schedule, date);
  }).catch(rethrowSessionConflict);
}

/**
 * Creates a session in a required program-cycle assignment; dates outside that cycle are 409.
 * @param programId - Program owning the session.
 * @param cycleId - Assigned cycle the actor must be allowed to access.
 * @param data - Validated session settings, with optional schedule defaults.
 * @param actor - Actor used for authorization and write metadata.
 * @returns The created session and any readable affected program-cycle rows after commit.
 * @example await createSession(programId, cycleId, { sessionTypeId, theme: 'Cooking', date: '2027-01-15' }, actor) // January 15 session using program default times
 */
export async function createSession(programId: string, cycleId: string, data: CreateSessionInput, actor: AccessTokenPayload) {
  // 1. Check access to the assigned program and cycle.
  await assertCanAccessProgramCycle(actor, programId, cycleId);
  return sql.begin(async tx => {
    const trx = asTransactionSql(tx);

    // 2. Lock the program, cycle, and assignment.
    await lockSessionAssignment(trx, programId, cycleId, actor);

    // 3. Load the cycle date bounds.
    const [cycle] = await trx<{ startsOn: string; endsOn: string }[]>`
      SELECT cycle.starts_on::text, cycle.ends_on::text
      FROM program_cycles cycle
      WHERE cycle.id = ${cycleId}
    `;

    if (!cycle) throw new InternalServerError('Locked cycle record is unavailable');

    // 4. Resolve the session date from program defaults.
    const schedule = await getProgramSchedule(trx, programId);
    const date = resolveSessionDate(data.date, schedule);
    if (date < cycle.startsOn || date > cycle.endsOn) {
      throw new ConflictError('Sessions must fall within the cycle date range');
    }

    // 5. Save the session within the validated cycle.
    return createScheduledSession(trx, programId, cycleId, data, actor, schedule, date);
  }).catch(rethrowSessionConflict);
}

/**
 * Updates an accessible session and returns its stored row; missing targets are 404.
 * @param id - Session the actor must be allowed to access.
 * @param data - Validated replacement session fields.
 * @param actor - Actor used for authorization, write metadata, and response scope.
 * @example await updateSession(sessionId, { theme: 'Cooking', startsAt: '2027-01-15T22:00:00Z', endsAt: '2027-01-15T23:00:00Z' }, actor) // returns the saved session with its existing type and cleared description
 */
export async function updateSession(id: string, data: UpdateSessionInput, actor: AccessTokenPayload) {
  // 1. Check access to the session.
  await assertCanAccessSession(actor, id);
  return sql.begin(async tx => {
    const trx = asTransactionSql(tx);

    // 2. Find the session assignment.
    const [session] = await trx<ProgramCycleKey[]>`SELECT program_id, cycle_id FROM program_sessions WHERE id = ${id}`;
    if (!session) throw new NotFoundError('Session not found');

    // 3. Lock the program, cycle, and assignment.
    await lockSessionAssignment(trx, session.programId, session.cycleId, actor);

    // 4. Save the replacement session details.
    const rows = await trx`
      UPDATE program_sessions
      SET session_type_id = COALESCE(${data.sessionTypeId ?? null}, session_type_id),
          theme = ${data.theme},
          starts_at = ${data.startsAt}, ends_at = ${data.endsAt},
          description = ${data.description ?? null}, updated_at = NOW(), updated_by = ${actor.userId}
      WHERE id = ${id}
      RETURNING id
    `;
    if (!rows.length) throw new NotFoundError('Session not found');

    // 5. Load the complete saved session for the response.
    const [saved] = await getSessionRowsByIds(trx, actor, [id]);
    if (!saved) throw new InternalServerError('Saved session record is unavailable');

    // 6. Load affected cycle rows and return them with the updated session.
    return { session: saved, updatedProgramCycles: await getUpdatedProgramCycles(trx, actor, [saved]) };
  }).catch(rethrowSessionConflict);
}

/**
 * Moves a future session to one assigned cycle while preserving local times and recorded history.
 * @param id - Accessible, non-cancelled session to move.
 * @param date - Validated destination calendar date in the program timezone.
 * @param actor - Actor used for authorization, write metadata, and response scope.
 * @example await moveSessionDate(sessionId, '2030-03-10', actor) // a Toronto 17:30 session keeps 17:30 local time across the move
 */
export async function moveSessionDate(id: string, date: string, actor: AccessTokenPayload) {
  // 1. Check access to the session.
  await assertCanAccessSession(actor, id);
  return sql.begin(async tx => {
    const trx = asTransactionSql(tx);

    // 2. Find the session program.
    const [lookup] = await trx<{ programId: string }[]>`
      SELECT session.program_id FROM program_sessions session
      WHERE session.id = ${id}
    `;
    if (!lookup) throw new NotFoundError('Session not found');

    // 3. Lock the program before resolving the destination cycle.
    await lockAssignmentProgram(trx, lookup.programId, actor);

    // 4. Load the program schedule and timezone.
    const schedule = await getProgramSchedule(trx, lookup.programId);

    // 5. Lock the session and derive its destination local times.
    const [session] = await trx<{
      cycleId: string; movable: boolean; startLocal: string; endLocal: string; endDate: string;
    }[]>`
      SELECT cycle_id, cancelled_at IS NULL AND starts_at > clock_timestamp() AS movable,
        (${date}::date + (starts_at AT TIME ZONE ${schedule.timezone})::time)::text AS start_local,
        (${date}::date + ((ends_at AT TIME ZONE ${schedule.timezone})::date
          - (starts_at AT TIME ZONE ${schedule.timezone})::date)
          + (ends_at AT TIME ZONE ${schedule.timezone})::time)::text AS end_local,
        (${date}::date + ((ends_at AT TIME ZONE ${schedule.timezone})::date
          - (starts_at AT TIME ZONE ${schedule.timezone})::date))::text AS end_date
      FROM program_sessions WHERE id = ${id} FOR UPDATE
    `;
    if (!session) throw new NotFoundError('Session not found');
    if (!session.movable) throw new ConflictError('Only future, non-cancelled sessions can be moved');

    // 6. Lock assigned cycles covering the destination dates.
    const assignments = await trx<ProgramCycleKey[]>`
      SELECT assignment.program_id, assignment.cycle_id
      FROM program_cycle_assignments assignment
      JOIN program_cycles cycle ON cycle.id = assignment.cycle_id
      WHERE assignment.program_id = ${lookup.programId}
        AND ${date}::date BETWEEN cycle.starts_on AND cycle.ends_on
        AND ${session.endDate}::date BETWEEN cycle.starts_on AND cycle.ends_on
      ORDER BY cycle.id FOR UPDATE OF cycle, assignment
    `;
    if (!assignments.length) throw new ConflictError('No assigned cycle covers this session date');
    if (assignments.length > 1) throw new ConflictError('Multiple assigned cycles cover this session date');

    // 7. Reject a cycle change when the session has recorded data.
    if (assignments[0].cycleId !== session.cycleId) {
      const [records] = await trx<{ recorded: boolean }[]>`
        SELECT EXISTS (SELECT 1 FROM attendance_records WHERE session_id = ${id})
          OR EXISTS (SELECT 1 FROM session_notes WHERE session_id = ${id})
          OR EXISTS (SELECT 1 FROM session_attachments WHERE session_id = ${id})
          OR EXISTS (SELECT 1 FROM time_entries WHERE session_id = ${id}) AS recorded
      `;
      if (records.recorded) throw new ConflictError('Sessions with recorded data cannot move to a different cycle');
    }

    // 8. Validate the destination times in the program timezone.
    const timing = await sessionTiming(trx, session.startLocal, session.endLocal, schedule.timezone);
    if (!timing.future) throw new ConflictError('Session destination must be in the future');

    // 9. Save the destination cycle and timestamps.
    await trx`
      UPDATE program_sessions SET cycle_id = ${assignments[0].cycleId},
        starts_at = ${timing.startsAt}, ends_at = ${timing.endsAt},
        updated_at = NOW(), updated_by = ${actor.userId}
      WHERE id = ${id}
      RETURNING id, program_id, cycle_id, starts_at, ends_at
    `;

    // 10. Load the complete moved session for the response.
    const [saved] = await getSessionRowsByIds(trx, actor, [id]);
    if (!saved) throw new InternalServerError('Saved session record is unavailable');

    // 11. Load affected cycle rows and return them with the moved session.
    return { session: saved, updatedProgramCycles: await getUpdatedProgramCycles(trx, actor, [{ programId: lookup.programId, cycleId: session.cycleId }, saved]) };
  }).catch(rethrowSessionConflict);
}

/**
 * Deletes an accessible session without attendance, notes, or attachments; dependencies are 409.
 * @param id - Required session to delete.
 * @param actor - Actor whose session access and response scope are enforced.
 * @example await deleteSession(sessionId, actor) // removes an unrecorded session and returns { id: sessionId, updatedProgramCycles }
 */
export async function deleteSession(id: string, actor: AccessTokenPayload) {
  // 1. Check access to the session.
  await assertCanAccessSession(actor, id);
  return sql.begin(async tx => {
    const trx = asTransactionSql(tx);

    // 2. Find the session assignment.
    const [lookup] = await trx<ProgramCycleKey[]>`SELECT program_id, cycle_id FROM program_sessions WHERE id = ${id}`;
    if (!lookup) throw new NotFoundError('Session not found');

    // 3. Lock the program, cycle, and assignment.
    await lockSessionAssignment(trx, lookup.programId, lookup.cycleId, actor);

    // 4. Lock the session before checking deletion dependencies.
    const [session] = await trx<ProgramCycleKey[]>`SELECT program_id, cycle_id FROM program_sessions WHERE id = ${id} FOR UPDATE`;
    if (!session) throw new NotFoundError('Session not found');

    // 5. Reject sessions with recorded attendance.
    const attendance = await trx`SELECT 1 FROM attendance_records WHERE session_id = ${id} LIMIT 1`;
    if (attendance.length) {
      throw new ConflictError('Session cannot be deleted because attendance has been recorded');
    }

    // 6. Reject sessions with recorded notes.
    const notes = await trx`SELECT 1 FROM session_notes WHERE session_id = ${id} LIMIT 1`;
    if (notes.length) {
      throw new ConflictError('Session cannot be deleted because session notes have been recorded');
    }

    // 7. Reject sessions with attachments.
    const attachments = await trx`SELECT 1 FROM session_attachments WHERE session_id = ${id} LIMIT 1`;
    if (attachments.length) {
      throw new ConflictError('Session cannot be deleted because attachments have been added');
    }

    // 8. Delete the session after the dependency checks.
    await trx`DELETE FROM program_sessions WHERE id = ${id}`;

    // 9. Load affected cycle rows and return them with the deleted session ID.
    return { id, updatedProgramCycles: await getUpdatedProgramCycles(trx, actor, [session]) };
  });
}

/**
 * Returns the first requested weekday on or after an ISO calendar date.
 * @param date - Validated YYYY-MM-DD calendar date.
 * @param weekday - Weekday to find, including the supplied date when it matches.
 * @example firstWeekdayOnOrAfter('2026-11-06', 'monday') // '2026-11-09'
 */
function firstWeekdayOnOrAfter(date: string, weekday: keyof typeof weekdayIndex) {
  const first = new Date(`${date}T12:00:00.000Z`);
  const offset = (weekdayIndex[weekday] - first.getUTCDay() + 7) % 7;
  first.setUTCDate(first.getUTCDate() + offset);
  return first.toISOString().slice(0, 10);
}

/**
 * Locks a program, cycle, and required assignment in order; missing assignments are 404.
 * @param trx - Existing transaction owning all acquired locks.
 * @param programId - Program to authorize and lock first.
 * @param cycleId - Cycle whose assignment must remain present.
 * @param actor - Actor whose program access must be enforced.
 * @example await lockSessionAssignment(trx, programId, cycleId, actor) // an absent assignment throws 404; locks last until the transaction ends
 */
async function lockSessionAssignment(trx: typeof sql, programId: string, cycleId: string, actor: AccessTokenPayload) {
  // 1. Authorize and lock the program.
  await lockAssignmentProgram(trx, programId, actor);

  // 2. Lock the required cycle.
  await trx`SELECT id FROM program_cycles WHERE id = ${cycleId} FOR UPDATE`;

  // 3. Lock and require the program-cycle assignment.
  const assignments = await trx`
    SELECT program_id FROM program_cycle_assignments
    WHERE program_id = ${programId} AND cycle_id = ${cycleId} FOR UPDATE
  `;
  if (!assignments.length) throw new NotFoundError('Program cycle not found');
}

/**
 * Returns required program defaults and its current local date/time; missing configuration is 500.
 * @param trx - Database client or transaction used for the lookup.
 * @param programId - Program whose schedule and timezone are needed.
 * @example await getProgramSchedule(trx, programId) // includes defaultStartTime: '17:30' for a program starting at 17:30
 */
async function getProgramSchedule(trx: typeof sql, programId: string): Promise<ProgramSchedule> {
  // 1. Load schedule defaults and the current local date and time.
  const [schedule] = await trx<ProgramSchedule[]>`
    SELECT default_day_of_week,
      to_char(default_start_time, 'HH24:MI') AS default_start_time,
      to_char(default_end_time, 'HH24:MI') AS default_end_time, timezone,
      (CURRENT_TIMESTAMP AT TIME ZONE timezone::text)::date::text AS today,
      to_char(CURRENT_TIMESTAMP AT TIME ZONE timezone::text, 'HH24:MI:SS') AS local_time
    FROM programs WHERE id = ${programId}
  `;
  if (!schedule) throw new InternalServerError('Required program schedule is unavailable');
  return schedule;
}

/**
 * Uses an explicit date or finds the next default weekday whose start time has not passed.
 * @param date - Validated explicit calendar date, or undefined to use defaults.
 * @param schedule - Program defaults and current local date/time.
 * @example resolveSessionDate('2027-01-15', schedule) // '2027-01-15' regardless of defaults
 * @example With Tuesday defaults at 17:30, Tuesday 2027-01-12 at 18:00 resolves to '2027-01-19'.
 */
function resolveSessionDate(date: string | undefined, schedule: ProgramSchedule) {
  if (date) return date;

  const nextDate = firstWeekdayOnOrAfter(schedule.today, schedule.defaultDayOfWeek);
  if (nextDate !== schedule.today || schedule.localTime < `${schedule.defaultStartTime}:00`) return nextDate;

  const nextWeek = new Date(`${nextDate}T12:00:00Z`);
  nextWeek.setUTCDate(nextWeek.getUTCDate() + 7);
  return nextWeek.toISOString().slice(0, 10);
}

/**
 * Creates one session from local schedule values and returns visible affected cycle rows.
 * @param trx - Existing transaction owning the session write.
 * @param programId - Program owning the session.
 * @param cycleId - Previously verified assigned cycle.
 * @param data - Validated session details and optional time overrides.
 * @param actor - Actor recorded on writes and used to scope response rows.
 * @param schedule - Program default times and timezone.
 * @param date - Resolved calendar date in the program timezone.
 * @example await createScheduledSession(trx, programId, cycleId, { sessionTypeId, theme: 'Cooking' }, actor, schedule, '2027-01-15') // inserts January 15 using schedule defaults
 */
async function createScheduledSession(
  trx: typeof sql,
  programId: string,
  cycleId: string,
  data: CreateSessionInput,
  actor: AccessTokenPayload,
  schedule: ProgramSchedule,
  date: string,
) {
  const startTime = data.startTime ?? schedule.defaultStartTime;
  const endTime = data.endTime ?? schedule.defaultEndTime;
  if (endTime <= startTime) throw new ConflictError('End time must be after start time');

  // 1. Validate local times and convert them to UTC.
  const timing = await sessionTiming(trx, `${date}T${startTime}`, `${date}T${endTime}`, schedule.timezone);

  // 2. Insert the session using the resolved schedule.
  const [session] = await trx`
    INSERT INTO program_sessions (
      program_id, cycle_id, session_type_id, theme, starts_at, ends_at, description, created_by, updated_by
    ) VALUES (
      ${programId}, ${cycleId}, ${data.sessionTypeId}, ${data.theme},
      ${timing.startsAt}, ${timing.endsAt},
      ${data.description ?? null}, ${actor.userId}, ${actor.userId}
    )
    RETURNING id, program_id, cycle_id, session_type_id, theme, starts_at, ends_at, description
  `;
  if (!session) throw new InternalServerError('Session creation returned no record');

  // 3. Load the complete created session for the response.
  const [saved] = await getSessionRowsByIds(trx, actor, [session.id]);
  if (!saved) throw new InternalServerError('Saved session record is unavailable');

  // 4. Load affected cycle rows and return them with the created session.
  return { ...saved, updatedProgramCycles: await getUpdatedProgramCycles(trx, actor, [{ programId, cycleId }]) };
}

/**
 * Returns affected cycle rows when the actor can read programs; otherwise returns undefined.
 * @param trx - Existing transaction used to load related rows.
 * @param actor - Actor whose read permission and row scope apply.
 * @param keys - Program-cycle pairs affected by the session operation.
 * @example getUpdatedProgramCycles(trx, sessionOnlyWriter, [{ programId, cycleId }]) // undefined without read:programs
 */
function getUpdatedProgramCycles(trx: typeof sql, actor: AccessTokenPayload, keys: ProgramCycleKey[]) {
  // 1. Load affected cycle rows only when the actor can read programs.
  return actor.permissions.includes('read:programs')
    ? getProgramCycleRowsByKeys(trx, actor, keys)
    : undefined;
}

/**
 * Resolves local timestamps and rejects invalid or ambiguous daylight-saving boundaries with 409.
 * @param trx - Existing transaction used for timezone conversion.
 * @param startLocal - Validated local session start timestamp without an offset.
 * @param endLocal - Validated local session end timestamp without an offset.
 * @param timezone - Program IANA timezone used for both conversions.
 * @returns UTC instants and whether the start is in the future; the caller decides whether a past start is allowed.
 * @example await sessionTiming(trx, '2027-01-15T17:30', '2027-01-15T19:30', 'America/Toronto') // startsAt is 2027-01-15T22:30:00Z
 */
async function sessionTiming(trx: typeof sql, startLocal: string, endLocal: string, timezone: string) {
  // 1. Convert local times and detect skipped or repeated clock times.
  const [timing] = await trx<{ valid: boolean; startsAt: Date; endsAt: Date; future: boolean }[]>`
    WITH times AS (
      SELECT ${startLocal}::timestamp AT TIME ZONE ${timezone} AS starts_at,
        ${endLocal}::timestamp AT TIME ZONE ${timezone} AS ends_at
    )
    SELECT starts_at, ends_at, starts_at > clock_timestamp() AS future, ends_at > starts_at
      AND starts_at AT TIME ZONE ${timezone} = ${startLocal}::timestamp
      AND ends_at AT TIME ZONE ${timezone} = ${endLocal}::timestamp
      AND NOT EXISTS (
        SELECT 1
        FROM (VALUES (starts_at), (ends_at)) AS boundary(instant)
        CROSS JOIN (VALUES (INTERVAL '-1 day'), (INTERVAL '1 day')) AS nearby(delta)
        CROSS JOIN LATERAL (
          SELECT ((boundary.instant + nearby.delta) AT TIME ZONE ${timezone})
            - ((boundary.instant AT TIME ZONE ${timezone}) + nearby.delta) AS offset_change
        ) AS transition
        WHERE transition.offset_change <> INTERVAL '0'
          AND (boundary.instant - transition.offset_change) AT TIME ZONE ${timezone}
            = boundary.instant AT TIME ZONE ${timezone}
      ) AS valid
    FROM times
  `;
  if (!timing.valid) throw new ConflictError('Session times are invalid in the program timezone');

  return timing;
}

/**
 * Adds context to duplicate session schedules without changing other failures.
 * @param error - Original transaction failure; only the duplicate schedule constraint is translated.
 * @example rethrowSessionConflict(new Error('offline')) // throws that same Error unchanged
 */
function rethrowSessionConflict(error: unknown): never {
  if (isUniqueViolation(error, 'uq_program_sessions_program_cycle_theme_start')) {
    throw Object.assign(new ConflictError('A session with this theme and start time already exists in this program cycle'), { cause: error });
  }
  throw error;
}
