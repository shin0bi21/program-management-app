import crypto from 'crypto';
import { sql, asTransactionSql } from '../../../db/client';
import { audit } from '../../shared/auditService';
import { ConflictError, ForbiddenError, InternalServerError, NotFoundError, createValidationError } from '../../../errors';
import type { AccessTokenPayload } from '../../../types/auth';
import {
  hoursRecordSchema,
  type HoursCalendarQuery,
  type HoursSessionQuery,
} from '../../../validation/hoursSchemas';
import { assertHoursWriteAccess } from '../../../policies/hoursPolicy';
import { canWriteTaskFor } from '../../../policies/taskPolicy';
import { getTask } from '../tasks/taskService';
import type { TaskRow } from '../tasks/taskRowQuery';
import type { SessionRow } from '../../programming/sessions/sessionRowQuery';
import {
  getHoursRows,
  type Hours,
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
  return sql<Hours[]>`
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
  return sql<Pick<SessionRow, 'id' | 'title' | 'date'>[]>`
    SELECT
      session.id,
      session.title,
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

type HoursMutationResult = Hours & { updatedTasks?: Awaited<ReturnType<typeof getTask>>[] };

/**
 * Saves an hours entry and returns the complete row and readable affected tasks.
 * A date-only move keeps the saved task link even when the task is closed.
 * @param input - Creation fields, or an existing ID and changes. Omitted edit fields retain stored values.
 * @param user - User whose access to the current and requested staff members is enforced.
 * @param completeTask - Whether creating task-linked hours should also complete the task.
 * @example await setHours({ id, date: '2030-03-10' }, user) // moves an existing entry
 */
export async function setHours(input: Partial<Hours>, user: AccessTokenPayload, completeTask = false): Promise<HoursMutationResult> {
  // 1. Authorize any requested staff reassignment before reading existing records.
  if (input.staffId) assertHoursWriteAccess(user, input.staffId);

  return sql.begin(async tx => {
    const trx = asTransactionSql(tx);
    const transactionId = crypto.randomUUID();
    const { id } = input;

    // 2. Lock the requested source before the entry. A task-linked move keeps its saved source.
    const draft = id
      ? mergeHoursEdit(input, await readOwnedHoursEntry(trx, id, user))
      : validateHoursRecord(input);
    await assertStaffActive(draft.staffId, trx);
    const movesLinkedTask = id && draft.type === 'task' && input.date !== undefined && Object.keys(input).length === 2;
    const resolvedScope = movesLinkedTask ? null : await resolveHoursScope(draft, trx);

    // 3. Merge against the locked entry so a concurrent edit cannot erase omitted fields.
    const previous = id ? await getOwnedEntry(trx, id, user) : null;
    const record = previous ? mergeHoursEdit(input, previous) : draft;
    const sourceChanged = draft.type !== record.type
      || draft.staffId !== record.staffId
      || (draft.type === 'task' && record.type === 'task' && draft.taskId !== record.taskId)
      || (draft.type === 'session' && record.type === 'session' && draft.sessionId !== record.sessionId);
    if (sourceChanged) throw new ConflictError('The hours source changed. Reload and try again.');

    // 4. Resolve the final program, category, work date and cycle.
    const scope = resolvedScope ?? previous;
    if (!scope) throw new InternalServerError('Hours source is unavailable');

    const programId = record.type === 'regular' ? record.programId : scope.programId;
    const category = record.type === 'regular' ? record.category : scope.category;
    const date = record.type === 'session' ? scope.date : record.date;
    if (id && record.type === 'session' && input.date !== undefined && input.date !== date) {
      throw new ConflictError('Session time must stay on the session date');
    }

    await assertProgramExists(programId, trx);
    const cycleId = await resolveCycleForDate(date, programId, trx);

    // 5. Save editable fields without replacing creation metadata.
    const values = {
      staffId: record.staffId,
      programId,
      cycleId,
      category,
      taskId: scope.taskId,
      sessionId: scope.sessionId,
      date,
      hours: record.hours,
      note: record.note,
      updatedBy: user.userId,
    };
    const [written] = await trx<Pick<Hours, 'id'>[]>`
      INSERT INTO time_entries ${trx({
        ...(id ? { id } : {}),
        ...values,
        createdBy: user.userId,
      })}
      ON CONFLICT (id) DO UPDATE
      SET ${trx(values)}, updated_at = NOW()
      RETURNING id
    `;
    if (!written) throw new InternalServerError('Hours save returned no record');

    const [saved] = await getHoursRows(user, trx`entry.id = ${written.id}`, trx);
    if (!saved) throw new InternalServerError('Saved hours record is unavailable');

    // 6. Complete a task when requested on creation and audit the change.
    await completeTaskFromHours(scope.taskId, !id && completeTask, record.staffId, trx, user, transactionId);
    await audit(
      trx,
      user.userId,
      transactionId,
      'time_entries',
      saved.id,
      previous ? 'UPDATE' : 'INSERT',
      previous ? { ...previous } : null,
      { ...saved },
    );

    // 7. Return the saved entry and tasks affected by the write.
    const updatedTasks = await getAffectedTasks([previous?.taskId, saved.taskId], user, trx);
    return { ...saved, ...(updatedTasks.length ? { updatedTasks } : {}) };
  });
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
  sessionId: SessionRow['id'],
  date: SessionRow['date'],
  userId: string,
  transactionId: string,
): Promise<void> {
  // 1. Move entries whose work date differs from the saved session date.
  const entries = await trx<Array<Pick<Hours, 'id'> & { previousDate: Hours['date'] }>>`
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
export async function deleteHours(id: Hours['id'], user: AccessTokenPayload) {
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

/**
 * Applies requested changes and validates the complete record for its effective source.
 * @param input - Validated edit fields.
 * @param existing - Saved entry fields used when the edit omits them.
 * @example mergeHoursEdit({ id, note: 'Updated' }, existing) // keeps the saved source and work date
 */
function mergeHoursEdit(
  { id: _id, date, ...changes }: Partial<Hours>,
  existing: Awaited<ReturnType<typeof readOwnedHoursEntry>>,
) {
  let existingSource: Hours['type'] = 'regular';
  if (existing.taskId) existingSource = 'task';
  if (existing.sessionId) existingSource = 'session';

  const source = changes.type ?? existingSource;
  const fields = {
    staffId: existing.staffId,
    hours: existing.hours,
    note: existing.note,
    ...changes,
    type: source,
  };
  const workDate = date ?? existing.date;
  const sameSource = source === existingSource;

  let draft: unknown;

  switch (source) {
    case 'regular':
      draft = {
        ...fields,
        date: workDate,
        programId: changes.programId !== undefined ? changes.programId : existing.programId,
        category: changes.category ?? (sameSource ? existing.category : undefined),
      };
      break;
    case 'task':
      draft = { ...fields, date: workDate, taskId: changes.taskId ?? (sameSource ? existing.taskId : undefined) };
      break;
    case 'session':
      draft = { ...fields, sessionId: changes.sessionId ?? (sameSource ? existing.sessionId : undefined) };
      break;
  }

  return validateHoursRecord(draft);
}

/**
 * Validates the fields needed to save hours for their requested source.
 * @param input - Fields from creation or a merged edit.
 * @example validateHoursRecord({ ...fields, type: 'task', taskId })
 */
function validateHoursRecord(input: unknown) {
  const parsed = hoursRecordSchema.safeParse(input);
  if (!parsed.success) {
    throw createValidationError(parsed.error.issues.map(issue => ({
      field: ['body', ...issue.path].join('.'),
      message: issue.message,
    })));
  }
  return parsed.data;
}

/**
 * Resolves an entry source and locks its task or session.
 * @param input - Validated entry.
 * @param trx - Owning transaction.
 * @example resolveHoursScope(input, trx) // source, category, and work date
 */
async function resolveHoursScope(input: ReturnType<typeof validateHoursRecord>, trx: typeof sql) {
  // 1. Use the supplied details for regular time.
  if (input.type === 'regular') return {
    programId: input.programId, category: input.category,
    taskId: null, sessionId: null, date: input.date,
  };

  // 2. Load the assigned session.
  if (input.type === 'session') {
    const rows = await trx<Pick<SessionRow, 'programId' | 'date'>[]>`
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
  const rows = await trx<Pick<TaskRow, 'category' | 'programId'>[]>`
    SELECT
      task.category,
      task.program_id
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
    programId: task.programId, category: task.category,
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
  taskId: Hours['taskId'],
  completeTask: boolean,
  staffId: Hours['staffId'],
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
 * @param query - Database connection or existing write transaction.
 * @example assertStaffActive(staffId) // throws for inactive accounts
 */
async function assertStaffActive(staffId: Hours['staffId'], query = sql) {
  // 1. Check that the staff account is active.
  const rows = await query<{ id: string }[]>`
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
async function assertProgramExists(programId: Hours['programId'], query = sql) {
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
async function resolveCycleForDate(date: Hours['date'], programId: Hours['programId'], query = sql) {
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
async function getOwnedEntry(trx: typeof sql, id: Hours['id'], user: AccessTokenPayload) {
  // 1. Lock the entry and authorize its current owner.
  await readOwnedHoursEntry(trx, id, user, true);

  const [row] = await getHoursRows(user, trx`entry.id = ${id}`, trx);
  if (!row) throw new InternalServerError('Locked hours record is unavailable');
  return row;
}

/**
 * Reads writable entry fields and optionally holds the row lock until commit.
 * @param trx - Hours transaction.
 * @param id - Required saved entry ID.
 * @param user - User whose write access is enforced.
 * @param lock - Whether to lock the entry for the write.
 * @example await readOwnedHoursEntry(trx, id, user) // reads the link before its source is locked
 */
async function readOwnedHoursEntry(trx: typeof sql, id: Hours['id'], user: AccessTokenPayload, lock = false) {
  const [entry] = await trx<Pick<Hours,
    'staffId' | 'programId' | 'category' | 'date' | 'hours' | 'note' | 'taskId' | 'sessionId'
  >[]>`
    SELECT staff_id, program_id, category, date, hours::double precision, note, task_id, session_id
    FROM time_entries
    WHERE id = ${id}
    ${lock ? trx`FOR UPDATE` : trx``}
  `;
  if (!entry) throw new NotFoundError('Logged hours not found');
  assertHoursWriteAccess(user, entry.staffId);
  return entry;
}

/**
 * Loads affected tasks when the user can read tasks.
 * @param taskIds - Previous and new linked tasks; missing IDs are ignored.
 * @param user - User whose read access is enforced.
 * @param trx - Owning transaction.
 * @example getAffectedTasks([taskId, taskId], user, trx) // one task
 */
async function getAffectedTasks(
  taskIds: Array<Hours['taskId'] | undefined>,
  user: AccessTokenPayload,
  trx: typeof sql,
) {
  // 1. Load each affected task once.
  if (!user.permissions.includes('read:tasks')) return [];

  const ids = [...new Set(taskIds.filter((id): id is string => Boolean(id)))];
  return Promise.all(ids.map(id => getTask(id, user, trx)));
}
