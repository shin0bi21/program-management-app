import crypto from 'crypto';
import { sql, asTransactionSql } from '../../../db/client';
import { audit } from '../../shared/auditService';
import { ConflictError, NotFoundError, InternalServerError } from '../../../errors';
import type { AccessTokenPayload } from '../../../types/auth';
import type { OpenTaskQuery, SetTaskInput, TaskPlacementInput } from '../../../validation/taskSchemas';
import { assertTaskWriteAccess, taskWriteScopePredicate } from '../../../policies/taskPolicy';
import { getTaskRows, type TaskRow } from './taskRowQuery';
import { TASK_CATEGORY_OPTIONS, TASK_STATUS_OPTIONS } from './taskReferenceData';

/**
 * Loads one accessible task with its logged hours.
 * @param id - Task to load.
 * @param actor - User whose staff scope is checked.
 * @param query - Database client; pass trx inside a transaction.
 * @example getTask(taskId, actor, trx)
 */
export async function getTask(id: string, actor: AccessTokenPayload, query = sql) {
  // 1. Load the accessible task.
  const rows = await getTaskRows(actor, query`task.id = ${id}`, query);
  if (!rows.length) throw new NotFoundError('Task not found');

  return rows[0];
}

/**
 * Lists accessible open tasks for logging hours.
 * @param actor - User whose staff scope is checked.
 * @param query - Optional staff selection.
 * @example getOpenTasks(actor, query)
 */
export async function getOpenTasks(actor: AccessTokenPayload, query: OpenTaskQuery) {
  // 1. Load accessible open tasks.
  return sql<TaskRow[]>`
    ${getTaskRows(actor, sql`
      ${query.staffId ? sql`task.staff_id = ${query.staffId}` : sql`TRUE`}
      AND task.state = 'open'
    `)}
    ORDER BY task.start_date, task.due_date, task.title, task.id
  `;
}

/**
 * Lists task categories and displayed statuses.
 * @example getTaskReferenceData() // categories and statuses
 */
export function getTaskReferenceData() {
  return { categories: TASK_CATEGORY_OPTIONS, statuses: TASK_STATUS_OPTIONS };
}

/**
 * Creates or updates an open task and returns the saved record.
 * @param input - Validated task details.
 * @param actor - User whose write access is checked.
 * @param id - Existing task ID; omit to create.
 * @example setTask(input, actor, taskId)
 */
export async function setTask(input: SetTaskInput, actor: AccessTokenPayload, id?: string) {
  // 1. Check the task change and assignee.
  if (id) return updateTaskRecord(id, input, actor);
  assertTaskWriteAccess(actor, input.staffId);
  const transactionId = crypto.randomUUID();

  return sql.begin(async tx => {
    const trx = asTransactionSql(tx);

    // 2. Check the selected staff member and program.
    await assertStaffActive(input.staffId, trx);
    await assertProgramExists(input.programId, trx);

    // 3. Save the task.
    const rows = await trx<{ id: string }[]>`
      INSERT INTO tasks (
        title, details, category, staff_id, program_id, state, start_date, due_date, completed_at, created_by, updated_by
      ) VALUES (
        ${input.title}, ${input.details}, ${input.category}, ${input.staffId}, ${input.programId}, 'open', ${input.startDate}, ${input.dueDate},
        null, ${actor.userId}, ${actor.userId}
      )
      RETURNING id
    `;
    if (!rows[0]) throw new InternalServerError('Task creation returned no record');
    const [created] = await getTaskRows(actor, trx`task.id = ${rows[0].id}`, trx);
    if (!created) throw new InternalServerError('Saved task record is unavailable');

    // 4. Record the change.
    await audit(trx, actor.userId, transactionId, 'tasks', created.id, 'INSERT', null, { ...created });

    // 5. Return the complete saved task before commit.
    return created;
  });
}

/**
 * Moves or resizes an open task without changing its content.
 * @param id - Task to change.
 * @param input - Validated dates and optional assignee.
 * @param actor - User whose write access is checked.
 * @example updateTaskPlacement(taskId, input, actor)
 */
export async function updateTaskPlacement(
  id: string,
  input: TaskPlacementInput,
  actor: AccessTokenPayload,
) {
  // 1. Check the destination assignee.
  if (input.staffId) assertTaskWriteAccess(actor, input.staffId);
  const transactionId = crypto.randomUUID();

  return sql.begin(async tx => {
    const trx = asTransactionSql(tx);

    // 2. Lock the accessible task.
    const existingRows = await trx<TaskRow[]>`
      ${getTaskRows(actor, trx`
        task.id = ${id}
        AND ${taskWriteScopePredicate(actor, trx`task.staff_id`)}
      `, trx)}
      FOR UPDATE OF task
    `;
    if (!existingRows.length) throw new NotFoundError('Task not found');

    // 3. Check whether the task can move.
    const existing = existingRows[0];
    if (isTerminalTask(existing)) {
      throw new ConflictError('Completed or cancelled tasks must be reopened before their placement can change');
    }
    const nextStaffId = input.staffId ?? existing.staffId;
    const assigneeChanged = nextStaffId !== existing.staffId;
    if (assigneeChanged) {
      await assertStaffActive(nextStaffId, trx);
      if (existing.hoursLogged > 0) {
        throw new ConflictError('Only open tasks without logged time can be reassigned');
      }
    }

    // 4. Save the placement.
    const rows = await trx<{ id: string }[]>`
      UPDATE tasks
      SET staff_id = ${nextStaffId}, start_date = ${input.startDate}, due_date = ${input.dueDate},
        updated_by = ${actor.userId}, updated_at = NOW()
      WHERE id = ${id}
      RETURNING id
    `;
    if (!rows[0]) throw new InternalServerError('Task update returned no record');
    const [updated] = await getTaskRows(actor, trx`task.id = ${id}`, trx);
    if (!updated) throw new InternalServerError('Saved task record is unavailable');

    // 5. Record the change.
    await audit(trx, actor.userId, transactionId, 'tasks', id, 'UPDATE', { ...existing }, { ...updated });

    // 6. Return the complete saved task before commit.
    return updated;
  });
}

/**
 * Completes, cancels, or reopens a task and returns its saved record.
 * @param id - Task to change.
 * @param state - Requested lifecycle state.
 * @param actor - User whose write access is checked.
 * @example updateTaskState(taskId, 'completed', actor) // requires logged time
 */
export async function updateTaskState(id: string, state: 'open' | 'completed' | 'cancelled', actor: AccessTokenPayload) {
  const transactionId = crypto.randomUUID();

  return sql.begin(async tx => {
    const trx = asTransactionSql(tx);

    // 1. Lock the accessible task.
    const existingRows = await trx<TaskRow[]>`
      ${getTaskRows(actor, trx`
        task.id = ${id}
        AND ${taskWriteScopePredicate(actor, trx`task.staff_id`)}
      `, trx)}
      FOR UPDATE OF task
    `;
    if (!existingRows.length) throw new NotFoundError('Task not found');

    // 2. Check the requested state.
    if (state === 'completed' && existingRows[0].state !== 'open') {
      throw new ConflictError('Only open tasks can be completed');
    }
    if (state === 'completed' && existingRows[0].hoursLogged === 0) {
      throw new ConflictError('Tasks need logged time before they can be completed');
    }
    if (state === 'cancelled' && existingRows[0].state !== 'open') {
      throw new ConflictError('Only open tasks can be cancelled');
    }
    if (state === 'open' && !['completed', 'cancelled'].includes(existingRows[0].state)) {
      throw new ConflictError('Only completed or cancelled tasks can be reopened');
    }

    // 3. Save the task state.
    const rows = await trx<{ id: string }[]>`
      UPDATE tasks
      SET state = ${state},
        completed_at = CASE
          WHEN ${state} = 'completed' THEN COALESCE(completed_at, NOW())
          ELSE NULL
        END,
        updated_by = ${actor.userId}, updated_at = NOW()
      WHERE id = ${id}
      RETURNING id
    `;
    if (!rows[0]) throw new InternalServerError('Task update returned no record');
    const [updated] = await getTaskRows(actor, trx`task.id = ${id}`, trx);
    if (!updated) throw new InternalServerError('Saved task record is unavailable');

    // 4. Record the change.
    await audit(trx, actor.userId, transactionId, 'tasks', id, 'UPDATE',
      { ...existingRows[0] }, { ...updated });

    // 5. Return the complete saved task before commit.
    return updated;
  });
}

/**
 * Deletes an accessible task with no logged hours.
 * @param id - Task to delete.
 * @param actor - User whose write access is checked.
 * @example deleteTask(taskId, actor) // throws 409 when hours exist
 */
export async function deleteTask(id: string, actor: AccessTokenPayload) {
  const transactionId = crypto.randomUUID();

  return sql.begin(async tx => {
    const trx = asTransactionSql(tx);

    // 1. Lock the accessible task.
    const existingRows = await trx<TaskRow[]>`
      ${getTaskRows(actor, trx`
        task.id = ${id}
        AND ${taskWriteScopePredicate(actor, trx`task.staff_id`)}
      `, trx)}
      FOR UPDATE OF task
    `;
    if (!existingRows.length) throw new NotFoundError('Task not found');

    // 2. Check for logged hours.
    const linkedEntries = await trx<{ exists: boolean }[]>`
      SELECT EXISTS (
        SELECT 1
        FROM time_entries
        WHERE task_id = ${id}
      ) AS exists
    `;
    if (linkedEntries[0].exists) {
      throw new ConflictError('Tasks with logged time cannot be deleted');
    }

    // 3. Delete the task and record the change.
    await trx`
      DELETE
      FROM tasks
      WHERE id = ${id}
    `;
    await audit(trx, actor.userId, transactionId, 'tasks', id, 'DELETE',
      { ...existingRows[0] }, null);
  });
}

/**
 * Replaces an open task's details while preserving its logged time.
 * @param id - Task to lock and update.
 * @param input - Validated replacement details.
 * @param actor - User whose write access is checked.
 * @example updateTaskRecord(taskId, input, actor)
 */
async function updateTaskRecord(id: string, input: SetTaskInput, actor: AccessTokenPayload) {
  // 1. Check the assignee.
  assertTaskWriteAccess(actor, input.staffId);
  const transactionId = crypto.randomUUID();

  return sql.begin(async tx => {
    const trx = asTransactionSql(tx);

    // 2. Check the selected staff member and program.
    await assertStaffActive(input.staffId, trx);
    await assertProgramExists(input.programId, trx);

    // 3. Lock the task and check whether it can be edited.
    const existingRows = await trx<TaskRow[]>`
      ${getTaskRows(actor, trx`
        task.id = ${id}
        AND ${taskWriteScopePredicate(actor, trx`task.staff_id`)}
      `, trx)}
      FOR UPDATE OF task
    `;
    if (!existingRows.length) throw new NotFoundError('Task not found');
    if (isTerminalTask(existingRows[0])) {
      throw new ConflictError('Completed or cancelled tasks must be reopened before they can be edited');
    }
    const oldStaffId = existingRows[0].staffId;
    const assigneeChanged = oldStaffId !== input.staffId;
    if (assigneeChanged && existingRows[0].hoursLogged > 0) {
      throw new ConflictError('Only open tasks without logged time can be reassigned');
    }

    // 4. Save the task details.
    const rows = await trx<{ id: string }[]>`
      UPDATE tasks
      SET title = ${input.title}, details = ${input.details}, category = ${input.category},
        staff_id = ${input.staffId}, program_id = ${input.programId},
        start_date = ${input.startDate}, due_date = ${input.dueDate},
        updated_by = ${actor.userId}, updated_at = NOW()
      WHERE id = ${id}
      RETURNING id
    `;
    if (!rows[0]) throw new InternalServerError('Task update returned no record');
    const [updated] = await getTaskRows(actor, trx`task.id = ${id}`, trx);
    if (!updated) throw new InternalServerError('Saved task record is unavailable');

    // 5. Record the change.
    await audit(trx, actor.userId, transactionId, 'tasks', id, 'UPDATE', { ...existingRows[0] }, { ...updated });

    // 6. Return the complete saved task before commit.
    return updated;
  });
}

/**
 * Reports whether a task is completed or cancelled.
 * @param task - Task whose stored lifecycle state is checked.
 * @example isTerminalTask(completedTask) // true
 */
function isTerminalTask(task: TaskRow) {
  return task.state === 'completed' || task.state === 'cancelled';
}

/**
 * Requires an active staff account.
 * @param staffId - Assignee to check.
 * @param trx - Transaction owning the task change.
 * @example assertStaffActive(staffId, trx) // throws 404 when unavailable
 */
async function assertStaffActive(staffId: string, trx: typeof sql) {
  const staff = await trx<{ id: string }[]>`
    SELECT
      staff.id
    FROM users staff
    INNER JOIN user_roles role ON role.id = staff.role_id
    INNER JOIN user_credentials credentials ON credentials.user_id = staff.id
    WHERE staff.id = ${staffId}
      AND role.name IN ('admin', 'project_manager', 'staff')
      AND credentials.status = 'active'
  `;
  if (!staff.length) throw new NotFoundError('Staff member not found');
}

/**
 * Requires the selected program when one is supplied.
 * @param programId - Selected program, or null for general tasks.
 * @param trx - Transaction owning the task change.
 * @example assertProgramExists(null, trx) // no restriction
 */
async function assertProgramExists(programId: string | null, trx: typeof sql) {
  if (programId) {
    const programs = await trx<{ id: string }[]>`
      SELECT id
      FROM programs
      WHERE id = ${programId}
      LIMIT 1
    `;
    if (!programs.length) throw new NotFoundError('Program not found');
  }
}
