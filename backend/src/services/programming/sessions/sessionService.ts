import { randomUUID } from 'node:crypto';
import { SESSION_TYPES } from '../../../types/programming';
import { asTransactionSql, sql } from '../../../db/client';
import { ConflictError, NotFoundError, InternalServerError, isUniqueViolation } from '../../../errors';
import { assertProgramAccess, assertSessionAccess } from '../../../policies/programAccessPolicy';
import { audit } from '../../shared/auditService';
import { lockAssignmentProgram } from '../programCycles/assignmentService';
import { getSessionRows, type SessionRow } from './sessionRowQuery';
import { buildSessionFilters } from './sessionRowFilters';
import { getProgramCycleRowsByKeys, type ProgramCycleKey } from '../programCycles/programCycleRowQuery';
import type { AccessTokenPayload } from '../../../types/auth';
import type { SetSessionInput } from '../../../validation/programmingSchemas';

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

type SessionFields = Pick<SessionRow, 'sessionType' | 'title' | 'date' | 'startTime' | 'endTime' | 'description'>;

interface SavedSessionFields extends SessionFields {
  cycleId: string;
  movable: boolean;
  today: string;
}

/**
 * Creates a session or saves changes to an existing session, including the work date of linked hours.
 * @param input - Program ID and fields for creation, or an existing session ID and changes.
 * @param user - User whose access is checked and whose ID is recorded on the write.
 * @returns The saved session in the same shape as the session list.
 * @example await setSession({ id: sessionId, date: '2030-03-10' }, user) // updates the date and resolves the cycle
 */
export async function setSession(input: SetSessionInput, user: AccessTokenPayload): Promise<SessionRow> {
  // 1. Authorize the target before resolving its schedule.
  if ('id' in input) {
    await assertSessionAccess(user, input.id);
  } else {
    await assertProgramAccess(user, input.programId);
  }

  return sql.begin(async tx => {
    const trx = asTransactionSql(tx);
    const transactionId = randomUUID();
    let programId: string;
    let current: SavedSessionFields | undefined;
    let previousSession: SessionRow | undefined;
    let fields: SessionFields;
    let requiredCycleId: string | undefined;

    // 2. Lock the program before loading saved fields or scheduling defaults.
    if ('id' in input) {
      const [session] = await trx<{ programId: string }[]>`
        SELECT program_id
        FROM program_sessions
        WHERE id = ${input.id}
      `;
      if (!session) throw new NotFoundError('Session not found');
      programId = session.programId;
      await lockAssignmentProgram(trx, programId, user);

      [current] = await trx<SavedSessionFields[]>`
        SELECT cycle_id, session_type, title, date,
          to_char(start_time, 'HH24:MI') AS start_time,
          to_char(end_time, 'HH24:MI') AS end_time,
          description,
          cancelled_at IS NULL AND date > CURRENT_DATE AS movable,
          CURRENT_DATE AS today
        FROM program_sessions
        WHERE id = ${input.id}
        FOR UPDATE
      `;
      if (!current) throw new NotFoundError('Session not found');
      [previousSession] = await buildSessionFilters(getSessionRows(user, trx), { ids: [input.id] }, trx);
      if (!previousSession) throw new InternalServerError('Saved session record is unavailable');

      const isDateOnlyUpdate = 'date' in input
        && Object.keys(input).every(field => field === 'id' || field === 'date');
      if (isDateOnlyUpdate) {
        if (!current.movable) throw new ConflictError('Only non-cancelled sessions on future dates can be moved');
        const date = input.date ?? current.date;
        if (date <= current.today) throw new ConflictError('Session destination must be after today');
        const { sessionType, title, startTime, endTime, description } = current;
        fields = { sessionType, title, date, startTime, endTime, description };
      } else {
        requiredCycleId = current.cycleId;
        fields = {
          sessionType: input.sessionType ?? current.sessionType,
          title: input.title ?? current.title,
          date: input.date ?? current.date,
          startTime: input.startTime ?? current.startTime,
          endTime: input.endTime ?? current.endTime,
          description: input.description === undefined ? current.description : input.description,
        };
      }
    } else {
      programId = input.programId;
      await lockAssignmentProgram(trx, programId, user);

      const schedule = await getProgramSchedule(programId, trx);
      fields = {
        sessionType: input.sessionType,
        title: input.title,
        date: input.date ?? schedule.nextDate,
        startTime: input.startTime ?? schedule.defaultStartTime,
        endTime: input.endTime ?? schedule.defaultEndTime,
        description: input.description ?? null,
      };
    }

    // 3. Resolve and lock the assigned cycle, then check the schedule and recorded history.
    const cycleId = await resolveSessionCycle(trx, programId, fields.date, requiredCycleId);
    if (fields.endTime <= fields.startTime) throw new ConflictError('End time must be after start time');

    const id = 'id' in input ? input.id : null;
    if (id && current && current.cycleId !== cycleId) {
      await assertSessionHasNoCycleHistory(trx, id);
    }

    // 4. Save the session, preserving creation and cancellation metadata on updates.
    const [record] = await trx<{ id: string }[]>`
      INSERT INTO program_sessions (
        id, program_id, cycle_id, session_type, title, date, start_time, end_time, description, created_by, updated_by
      ) VALUES (
        COALESCE(${id}::uuid, gen_random_uuid()), ${programId}, ${cycleId}, ${fields.sessionType}, ${fields.title},
        ${fields.date}, ${fields.startTime}, ${fields.endTime}, ${fields.description}, ${user.userId}, ${user.userId}
      )
      ON CONFLICT (id) DO UPDATE SET
        cycle_id = EXCLUDED.cycle_id,
        session_type = EXCLUDED.session_type,
        title = EXCLUDED.title,
        date = EXCLUDED.date,
        start_time = EXCLUDED.start_time,
        end_time = EXCLUDED.end_time,
        description = EXCLUDED.description,
        updated_at = NOW(),
        updated_by = EXCLUDED.updated_by
      RETURNING id
    `;
    if (!record) throw new InternalServerError('Session save returned no record');

    // 5. Move linked hours to the saved session date before committing.
    if (current && fields.date !== current.date) {
      await syncSessionHoursDate(trx, record.id, fields.date, user.userId, transactionId);
    }

    // 6. Return the canonical session.
    const [session] = await buildSessionFilters(getSessionRows(user, trx), { ids: [record.id] }, trx);
    if (!session) throw new InternalServerError('Saved session record is unavailable');

    // 7. Record the canonical saved change.
    await audit(
      trx,
      user.userId,
      transactionId,
      'program_sessions',
      session.id,
      current ? 'UPDATE' : 'INSERT',
      previousSession ? { ...previousSession } : null,
      { ...session },
    );

    return session;
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
 * Locks the selected assignment or resolves exactly one assignment covering the date.
 * @param trx - Transaction already holding the program lock.
 * @param programId - Program that owns the assignment.
 * @param date - Business date that must fall within the assigned cycle.
 * @param requiredCycleId - Existing assignment for a full edit.
 * @example await resolveSessionCycle(trx, programId, '2030-03-10') // cycle ID covering March 10
 */
async function resolveSessionCycle(trx: typeof sql, programId: string, date: string, requiredCycleId?: string): Promise<string> {
  const selection = requiredCycleId
    ? trx`cycle.id = ${requiredCycleId}`
    : trx`${date}::date BETWEEN cycle.starts_on AND cycle.ends_on`;
  const cycles = await trx<{ id: string; startsOn: string; endsOn: string }[]>`
    SELECT cycle.id, cycle.starts_on, cycle.ends_on
    FROM program_cycle_assignments assignment
    INNER JOIN program_cycles cycle ON cycle.id = assignment.cycle_id
    WHERE assignment.program_id = ${programId} AND ${selection}
    ORDER BY cycle.id
    FOR UPDATE OF cycle, assignment
  `;

  if (requiredCycleId && !cycles.length) throw new NotFoundError('Program cycle not found');
  if (!cycles.length) {
    throw new ConflictError('No assigned cycle covers this session date. Assign a cycle covering this date in Programming settings.');
  }
  if (cycles.length > 1) {
    throw new ConflictError('Multiple assigned cycles cover this session date. Adjust the overlapping cycle dates in Programming settings.');
  }

  const [cycle] = cycles;
  if (date < cycle.startsOn || date > cycle.endsOn) {
    throw new ConflictError('Sessions must fall within the cycle date range');
  }
  return cycle.id;
}

/**
 * Rejects cycle changes when attendance, notes, attachments, or hours already exist.
 * @param trx - Transaction holding the session lock.
 * @param id - Session whose recorded data must stay in its original cycle.
 * @example await assertSessionHasNoCycleHistory(trx, sessionId) // throws 409 for recorded sessions
 */
async function assertSessionHasNoCycleHistory(trx: typeof sql, id: string): Promise<void> {
  const [records] = await trx<{ recorded: boolean }[]>`
    SELECT EXISTS (SELECT 1 FROM attendance_records WHERE session_id = ${id})
      OR EXISTS (SELECT 1 FROM session_notes WHERE session_id = ${id})
      OR EXISTS (SELECT 1 FROM session_attachments WHERE session_id = ${id})
      OR EXISTS (SELECT 1 FROM time_entries WHERE session_id = ${id}) AS recorded
  `;
  if (records.recorded) throw new ConflictError('Sessions with recorded data cannot move to a different cycle');
}

/**
 * Updates and audits the work date of hours linked to a rescheduled session.
 * @param trx - Session save transaction holding the session lock.
 * @param sessionId - Session whose logged hours follow the new date.
 * @param date - Saved session date within its assigned cycle.
 * @param userId - User recorded on the Hours update and audit entries.
 * @example await syncSessionHoursDate(trx, sessionId, '2030-03-10', userId)
 */
async function syncSessionHoursDate(
  trx: typeof sql,
  sessionId: string,
  date: string,
  userId: string,
  transactionId: string,
): Promise<void> {
  const entries = await trx<{ id: string; previousDate: string }[]>`
    WITH previous AS (
      SELECT id, date
      FROM time_entries
      WHERE session_id = ${sessionId} AND date <> ${date}::date
      ORDER BY id
      FOR UPDATE
    )
    UPDATE time_entries entry
    SET date = ${date},
      updated_at = NOW(),
      updated_by = ${userId}
    FROM previous
    WHERE entry.id = previous.id
    RETURNING entry.id, previous.date AS previous_date
  `;
  if (!entries.length) return;

  for (const { id, previousDate } of entries) {
    await audit(trx, userId, transactionId, 'time_entries', id, 'UPDATE',
      { sessionId, date: previousDate }, { sessionId, date });
  }
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
