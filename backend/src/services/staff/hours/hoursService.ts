import crypto from 'crypto';
import { sql, asTransactionSql } from '../../../db/client';
import { audit } from '../../shared/auditService';
import { ConflictError, ForbiddenError, InternalServerError, NotFoundError } from '../../../errors';
import type { AccessTokenPayload } from '../../../types/auth';
import type {
  SetHoursInput,
  HoursCategory,
  HoursCalendarQuery,
  HoursSessionQuery,
  UpdateHoursPlacementInput,
} from '../../../validation/hoursSchemas';
import { assertHoursWriteAccess } from '../../../policies/hoursPolicy';
import { canWriteTaskFor } from '../../../policies/taskPolicy';
import { getTask } from '../tasks/taskService';
import {
  getHoursRows,
  type HoursRow,
} from './hoursRowQuery';
import {
  HOURS_CATEGORY_OPTIONS,
  HOURS_ITEM_TYPE_OPTIONS,
} from './hoursReferenceData';
import { buildHoursFilters } from './hoursRowFilters';

/**
 * Lists hours matching the calendar filters.
 * @param user - User whose staff scope limits the results.
 * @param query - Validated calendar filters.
 * @example getHoursCalendarData(user, query) // matching entries
 */
export async function getHoursCalendarData(user: AccessTokenPayload, query: HoursCalendarQuery) {
  // 1. Load hours matching the calendar filters.
  return sql<HoursRow[]>`
    ${getHoursRows(user, sql`
      ${query.start && query.end
        ? sql`entry.date BETWEEN ${query.start}::date AND ${query.end}::date`
        : sql`TRUE`}
      AND ${buildHoursFilters(query)}
    `)}
    ORDER BY entry.date, staff.first_name, staff.last_name, entry.created_at, entry.id
  `;
}

/**
 * Lists the supported hours categories and sources.
 * @example getHoursReferenceData() // categories and types
 */
export function getHoursReferenceData() {
  // 1. Return the supported choices.
  return { categories: HOURS_CATEGORY_OPTIONS, types: HOURS_ITEM_TYPE_OPTIONS };
}

/**
 * Lists assigned sessions available for logging hours.
 * @param user - User who must be allowed to log time for this staff member.
 * @param query - Staff member and work date.
 * @example getHoursSessions(user, query) // matching session options
 */
export async function getHoursSessions(user: AccessTokenPayload, query: HoursSessionQuery) {
  // 1. Check access to the staff member.
  assertHoursWriteAccess(user, query.staffId);
  await assertStaffActive(query.staffId);

  // 2. Load assigned sessions for the work date.
  return sql<Array<{
    id: string; name: string; date: string;
  }>>`
    SELECT
      session.id,
      session.title AS name,
      session.date
    FROM program_sessions session
    INNER JOIN programs program ON program.id = session.program_id
    INNER JOIN users target_staff ON target_staff.id = ${query.staffId}
    WHERE session.cancelled_at IS NULL
      AND session.date = ${query.date}::date
      AND EXISTS (
        SELECT 1
        FROM user_program_assignments assignment
        WHERE assignment.program_id = program.id
          AND assignment.user_id = target_staff.id
      )
    ORDER BY session.start_time, session.id
  `;
}

/**
 * Creates or updates an hours entry and returns its affected rows.
 * @param input - Validated time entry.
 * @param user - User whose write access is enforced.
 * @param id - Existing entry ID; omit to create.
 * @example setHours(input, user, id) // saved entry and affected tasks
 */
export async function setHours(
  input: SetHoursInput,
  user: AccessTokenPayload,
  id?: string,
) {
  // 1. Check access to the staff member.
  assertHoursWriteAccess(user, input.staffId);
  await assertStaffActive(input.staffId);
  const transactionId = crypto.randomUUID();
  let saved!: HoursRow;
  let updatedTasks: Awaited<ReturnType<typeof getTask>>[] = [];
  await sql.begin(async tx => {
    const trx = asTransactionSql(tx);

    // 2. Check the source and work date.
    const scope = await resolveHoursScope(input, trx);
    await assertProgramExists(scope.programId, trx);
    const cycleId = await resolveCycleForDate(scope.date, scope.programId, trx);
    const existing = id ? await getOwnedEntry(trx, id, user) : null;

    // 3. Save the hours entry.
    const savedId = id
      ? await updateHoursRecord(trx, id, input, scope, cycleId, user.userId)
      : await insertHoursRecord(trx, input, scope, cycleId, user.userId);
    [saved] = await getHoursRows(user, trx`entry.id = ${savedId}`, trx);
    if (!saved) throw new InternalServerError('Saved hours record is unavailable');

    // 4. Complete the task if requested and record the change.
    const completeTask = !id && input.source === 'task' && input.completeTask;
    await completeTaskFromHours(scope.taskId, completeTask, input.staffId, trx, user, transactionId);
    await audit(
      trx,
      user.userId,
      transactionId,
      'time_entries',
      saved.id,
      id ? 'UPDATE' : 'INSERT',
      existing ? { ...existing } : null,
      { ...saved },
    );

    // 5. Load the affected tasks.
    updatedTasks = await getAffectedTasks([existing?.taskId, scope.taskId], user, trx);
  });
  return {
    ...saved,
    ...(updatedTasks.length ? { updatedTasks } : {}),
  };
}

/**
 * Moves an hours entry to another work date.
 * @param id - Entry to move.
 * @param input - Validated destination date.
 * @param user - User whose write access is enforced.
 * @example updateHoursPlacement(id, input, user) // updated entry and affected tasks
 */
export async function updateHoursPlacement(
  id: string,
  input: UpdateHoursPlacementInput,
  user: AccessTokenPayload,
) {
  const transactionId = crypto.randomUUID();
  let updated!: HoursRow;
  let updatedTasks: Awaited<ReturnType<typeof getTask>>[] = [];
  await sql.begin(async tx => {
    const trx = asTransactionSql(tx);

    // 1. Load the entry and check access.
    const existing = await getOwnedEntry(trx, id, user);
    if (existing.sessionId && input.date !== existing.date) {
      throw new ConflictError('Session time must stay on the session date');
    }

    // 2. Find the destination cycle and move the entry.
    const cycleId = await resolveCycleForDate(input.date, existing.programId, trx);
    await trx`
      UPDATE time_entries
      SET date = ${input.date},
        cycle_id = ${cycleId},
        updated_by = ${user.userId},
        updated_at = NOW()
      WHERE id = ${id}
    `;
    [updated] = await getHoursRows(user, trx`entry.id = ${id}`, trx);
    if (!updated) throw new InternalServerError('Updated hours record is unavailable');

    // 3. Record the change and load affected tasks.
    await audit(trx, user.userId, transactionId, 'time_entries', id, 'UPDATE', { ...existing }, { ...updated });
    updatedTasks = await getAffectedTasks([existing.taskId], user, trx);
  });
  return {
    ...updated,
    ...(updatedTasks.length ? { updatedTasks } : {}),
  };
}

/**
 * Moves linked hours to the saved session date and audits each changed entry.
 * @param trx - Transaction holding the lock on the rescheduled session.
 * @param sessionId - Session whose logged hours follow the new date.
 * @param date - Saved session date within its assigned cycle.
 * @param userId - User who rescheduled the session.
 * @param transactionId - Audit group shared with the session save.
 * @example await syncSessionHoursDate(trx, sessionId, '2030-03-10', userId, transactionId)
 */
export async function syncSessionHoursDate(
  trx: typeof sql,
  sessionId: string,
  date: string,
  userId: string,
  transactionId: string,
): Promise<void> {
  // 1. Move entries whose work date differs from the saved session date.
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

  // 2. Record each date change in the session's audit group.
  for (const { id, previousDate } of entries) {
    await audit(trx, userId, transactionId, 'time_entries', id, 'UPDATE',
      { sessionId, date: previousDate }, { sessionId, date });
  }
}

/**
 * Deletes an accessible hours entry and returns affected tasks.
 * @param id - Entry to delete.
 * @param user - User whose write access is enforced.
 * @example deleteHours(id, user) // deletion result
 */
export async function deleteHours(id: string, user: AccessTokenPayload) {
  const transactionId = crypto.randomUUID();
  let updatedTasks: Awaited<ReturnType<typeof getTask>>[] = [];
  await sql.begin(async tx => {
    const trx = asTransactionSql(tx);

    // 1. Load the entry and check access.
    const existing = await getOwnedEntry(trx, id, user);

    // 2. Delete the entry and record the change.
    await trx`
      DELETE
      FROM time_entries
      WHERE id = ${id}
    `;
    await audit(trx, user.userId, transactionId, 'time_entries', id, 'DELETE', { ...existing }, null);

    // 3. Load the affected tasks.
    updatedTasks = await getAffectedTasks([existing.taskId], user, trx);
  });
  return { message: 'Logged hours deleted', ...(updatedTasks.length ? { updatedTasks } : {}) };
}

type ResolvedHoursScope = Awaited<ReturnType<typeof resolveHoursScope>>;

/**
 * Inserts the resolved hours entry inside its transaction.
 * @param trx - Owning transaction.
 * @param input - Validated entry.
 * @param scope - Resolved source and work date.
 * @param cycleId - Cycle covering the work date.
 * @param userId - User recorded on the entry.
 * @example insertHoursRecord(trx, input, scope, cycleId, userId) // new ID
 */
async function insertHoursRecord(
  trx: typeof sql,
  input: SetHoursInput,
  scope: ResolvedHoursScope,
  cycleId: string,
  userId: string,
) {
  // 1. Save the hours entry.
  const [created] = await trx<{ id: string }[]>`
    INSERT INTO time_entries (
      staff_id, program_id, cycle_id, category, task_id, session_id,
      date, hours, note, created_by, updated_by
    )
    VALUES (
      ${input.staffId}, ${scope.programId}, ${cycleId}, ${scope.category}, ${scope.taskId},
      ${scope.sessionId}, ${scope.date}, ${input.hours}, ${input.note}, ${userId}, ${userId}
    )
    RETURNING id
  `;
  if (!created) throw new InternalServerError('Hours creation returned no record');
  return created.id;
}

/**
 * Updates a locked hours entry inside its transaction.
 * @param trx - Owning transaction.
 * @param id - Locked entry ID.
 * @param input - Validated entry.
 * @param scope - Resolved source and work date.
 * @param cycleId - Cycle covering the work date.
 * @param userId - User recorded on the entry.
 * @example updateHoursRecord(trx, id, input, scope, cycleId, userId) // saved ID
 */
async function updateHoursRecord(
  trx: typeof sql,
  id: string,
  input: SetHoursInput,
  scope: ResolvedHoursScope,
  cycleId: string,
  userId: string,
) {
  // 1. Save the changed hours entry.
  const [updated] = await trx<{ id: string }[]>`
    UPDATE time_entries
    SET staff_id = ${input.staffId},
      program_id = ${scope.programId},
      cycle_id = ${cycleId},
      category = ${scope.category},
      task_id = ${scope.taskId},
      session_id = ${scope.sessionId},
      date = ${scope.date},
      hours = ${input.hours},
      note = ${input.note},
      updated_by = ${userId},
      updated_at = NOW()
    WHERE id = ${id}
    RETURNING id
  `;
  if (!updated) throw new InternalServerError('Locked hours update returned no record');
  return updated.id;
}

/**
 * Resolves an entry source and locks its task or session.
 * @param input - Validated entry.
 * @param trx - Owning transaction.
 * @example resolveHoursScope(input, trx) // source, category, and work date
 */
async function resolveHoursScope(input: SetHoursInput, trx: typeof sql) {
  // 1. Use the supplied details for regular time.
  if (input.source === 'regular') return {
    programId: input.programId, category: input.category,
    taskId: null, sessionId: null, date: input.date,
  };

  // 2. Load the assigned session.
  if (input.source === 'session') {
    const rows = await trx<Array<{ programId: string; date: string }>>`
      SELECT
        session.program_id,
        session.date
      FROM program_sessions session
      INNER JOIN users target_staff ON target_staff.id = ${input.staffId}
      WHERE session.id = ${input.sessionId}
        AND session.cancelled_at IS NULL
        AND EXISTS (
          SELECT 1
          FROM user_program_assignments assignment
          WHERE assignment.program_id = session.program_id
            AND assignment.user_id = target_staff.id
        )
      LIMIT 1
      FOR UPDATE OF session
    `;
    if (!rows.length) throw new NotFoundError('Assigned session not found');
    return {
      ...rows[0], category: 'program_delivery' as const,
      taskId: null, sessionId: input.sessionId,
    };
  }

  // 3. Load the assigned task.
  const rows = await trx<Array<{ category: string; programId: string | null; startDate: string; dueDate: string }>>`
    SELECT
      task.category,
      task.program_id,
      task.start_date,
      task.due_date
    FROM tasks task
    WHERE task.id = ${input.taskId}
      AND task.staff_id = ${input.staffId}
      AND task.state = 'open'
    LIMIT 1
    FOR UPDATE OF task
  `;
  if (!rows.length) throw new NotFoundError('Assigned task not found');
  const task = rows[0];
  return {
    programId: task.programId, category: task.category as HoursCategory,
    taskId: input.taskId, sessionId: null, date: input.date,
  };
}

/**
 * Completes a task when requested while logging new hours.
 * @param taskId - Linked task, if any.
 * @param completeTask - Whether completion was requested.
 * @param staffId - Staff member who owns the task.
 * @param trx - Owning transaction.
 * @param user - User whose task-write access is enforced.
 * @param transactionId - Audit group for this save.
 * @example completeTaskFromHours(taskId, false, staffId, trx, user, transactionId) // no change
 */
async function completeTaskFromHours(
  taskId: string | null,
  completeTask: boolean,
  staffId: string,
  trx: typeof sql,
  user: AccessTokenPayload,
  transactionId: string,
) {
  // 1. Complete the task when requested.
  if (!taskId || !completeTask) return;
  if (!canWriteTaskFor(user, staffId)) {
    throw new ForbiddenError('Task write permission is required to complete a task');
  }
  await trx`
    UPDATE tasks
    SET state = 'completed',
      completed_at = NOW(),
      updated_by = ${user.userId},
      updated_at = NOW()
    WHERE id = ${taskId}
  `;
  await audit(trx, user.userId, transactionId, 'tasks', taskId, 'UPDATE',
    { state: 'open', staffId }, { state: 'completed', staffId });
}

/**
 * Requires an active staff account for logging time.
 * @param staffId - Staff member to check; unavailable accounts raise 404.
 * @example assertStaffActive(staffId) // throws for inactive accounts
 */
async function assertStaffActive(staffId: string) {
  // 1. Check that the staff account is active.
  const rows = await sql<{ id: string }[]>`
    SELECT
      staff.id
    FROM users staff
    INNER JOIN user_roles role ON role.id = staff.role_id
    INNER JOIN user_credentials credentials ON credentials.user_id = staff.id
    WHERE staff.id = ${staffId}
      AND role.name IN ('admin', 'project_manager', 'staff')
      AND credentials.status = 'active'
    LIMIT 1
  `;
  if (!rows.length) throw new NotFoundError('Staff member not found');
}

/**
 * Checks that a selected program exists.
 * @param programId - Selected program; null is general time.
 * @param query - Defaults to the shared client; pass trx for a transaction.
 * @example assertProgramExists(null, trx) // no program check
 */
async function assertProgramExists(programId: string | null, query = sql) {
  // 1. Check the selected program.
  if (!programId) return;

  const rows = await query<{ id: string }[]>`
    SELECT id
    FROM programs
    WHERE id = ${programId}
    LIMIT 1
  `;
  if (!rows.length) throw new NotFoundError('Program not found');
}

/**
 * Finds the one eligible cycle covering a work date.
 * @param date - Validated work date.
 * @param programId - Program whose assignments limit eligible cycles, or null.
 * @param query - Defaults to the shared client; pass trx for a transaction.
 * @example resolveCycleForDate(date, programId, trx) // cycle ID, or 409
 */
async function resolveCycleForDate(date: string, programId: string | null, query = sql) {
  // 1. Find the eligible cycle for the work date.
  const rows = await query<{ id: string }[]>`
    SELECT cycle.id
    FROM program_cycles cycle
    WHERE ${date}::date BETWEEN cycle.starts_on AND cycle.ends_on
      AND ${programId ? query`EXISTS (
        SELECT 1
        FROM program_cycle_assignments assignment
        WHERE assignment.program_id = ${programId}
          AND assignment.cycle_id = cycle.id
      )` : query`TRUE`}
    ORDER BY cycle.starts_on, cycle.id
    LIMIT 2
  `;
  if (!rows.length) throw new ConflictError('No cycle covers the selected work date');
  if (rows.length > 1) throw new ConflictError('Multiple cycles cover the selected work date');
  return rows[0].id;
}

/**
 * Loads and locks an hours entry the user can change.
 * @param trx - Owning transaction.
 * @param id - Entry to lock.
 * @param user - User whose write access is enforced.
 * @example getOwnedEntry(trx, id, user) // locked entry
 */
async function getOwnedEntry(trx: typeof sql, id: string, user: AccessTokenPayload) {
  // 1. Load the entry and check access.
  const [entry] = await trx<Array<{ staffId: string }>>`
    SELECT staff_id
    FROM time_entries
    WHERE id = ${id}
    FOR UPDATE
  `;
  if (!entry) throw new NotFoundError('Logged hours not found');
  assertHoursWriteAccess(user, entry.staffId);

  // Authorize the locked owner before loading the full scoped record, preserving 403 for forbidden writes.
  const [row] = await getHoursRows(user, trx`entry.id = ${id}`, trx);
  if (!row) throw new InternalServerError('Locked hours record is unavailable');
  return row;
}

/**
 * Loads affected tasks when the user can read tasks.
 * @param taskIds - Previous and new linked tasks; missing IDs are ignored.
 * @param user - User whose read access is enforced.
 * @param trx - Owning transaction.
 * @example getAffectedTasks([taskId, taskId], user, trx) // one task
 */
async function getAffectedTasks(
  taskIds: Array<string | null | undefined>,
  user: AccessTokenPayload,
  trx: typeof sql,
) {
  // 1. Load each affected task once.
  if (!user.permissions.includes('read:tasks')) return [];

  const ids = [...new Set(taskIds.filter((id): id is string => Boolean(id)))];
  return Promise.all(ids.map(id => getTask(id, user, trx)));
}
