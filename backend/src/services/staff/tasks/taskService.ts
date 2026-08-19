import crypto from 'crypto';
import { sql, asTransactionSql } from '../../../db/client';
import { audit } from '../../shared/auditService';
import { ConflictError, NotFoundError } from '../../../errors';
import type { AccessTokenPayload } from '../../../types/auth';
import type { SetTaskInput, TaskPlacementInput, TaskQuery } from '../../../validation/taskSchemas';
import { assertCanAssignTaskTo, taskReadScopePredicate, taskResourceReadScopePredicate, taskWriteScopePredicate } from '../../../policies/taskPolicy';
import {
  attachTaskDetails,
  loadTaskLoggedHours,
  taskRecordColumns,
  taskRecordFrom,
  type TaskRow,
} from './taskRecordQuery';


export async function getTasks(actor: AccessTokenPayload, query: TaskQuery) {
  const rows = await sql<TaskRow[]>`
    SELECT ${taskRecordColumns}
    ${taskRecordFrom}
    WHERE ${query.staffId ? sql`task.staff_id = ${query.staffId}` : sql`TRUE`}
      AND ${query.start && query.end
        ? sql`task.start_date <= ${query.end}::date AND task.due_date >= ${query.start}::date`
        : sql`TRUE`}
      AND ${taskReadScopePredicate(actor, sql`task.staff_id`)}
      AND ${query.category ? sql`task.category = ${query.category}` : sql`TRUE`}
      AND ${query.includeClosed ? sql`TRUE` : sql`task.status = 'open'`}
    ORDER BY task.start_date, task.due_date, task.title, task.id
  `;
  const taskIds = rows.map(row => row.id);
  return attachTaskDetails(rows, await loadTaskLoggedHours(taskIds), actor);
}

export async function setTask(input: SetTaskInput, actor: AccessTokenPayload, id?: string) {
  if (id) return updateTaskRecord(id, input, actor);
  assertCanAssignTaskTo(actor, input.staffId);
  const transactionId = crypto.randomUUID();
  let created!: TaskRow;
  await sql.begin(async tx => {
    const trx = asTransactionSql(tx);
    await assertActiveStaffResource(input.staffId, trx);
    await assertProgramExists(input.programId, trx);
    const rows = await trx<TaskRow[]>`
      INSERT INTO tasks (
        title, details, category, staff_id, program_id, status, start_date, due_date, completed_at, created_by, updated_by
      ) VALUES (
        ${input.title}, ${input.details}, ${input.category}, ${input.staffId}, ${input.programId}, 'open', ${input.startDate}, ${input.dueDate},
        null, ${actor.userId}, ${actor.userId}
      )
      RETURNING id, title, details, category, staff_id,
        (SELECT first_name FROM users WHERE id = tasks.staff_id) AS staff_first_name,
        (SELECT last_name FROM users WHERE id = tasks.staff_id) AS staff_last_name,
        (SELECT CONCAT(first_name, ' ', last_name) FROM users WHERE id = tasks.staff_id) AS staff_name,
        program_id,
        (SELECT name FROM programs WHERE id = tasks.program_id) AS program_name,
        status, start_date::text, due_date::text, completed_at::text, 0::float AS hours_logged
    `;
    created = rows[0];
    await audit(trx, actor.userId, transactionId, 'tasks', created.id, 'INSERT', null, { ...created, staffId: input.staffId });
  });
  return attachTaskDetails([created], [], actor)[0];
}

export async function updateTaskPlacement(
  id: string,
  input: TaskPlacementInput,
  actor: AccessTokenPayload,
) {
  if (input.staffId) assertCanAssignTaskTo(actor, input.staffId);
  const transactionId = crypto.randomUUID();
  let updated!: TaskRow;

  await sql.begin(async tx => {
    const trx = asTransactionSql(tx);
    const existingRows = await trx<TaskRow[]>`
      SELECT ${taskRecordColumns}
      ${taskRecordFrom}
      WHERE task.id = ${id}
        AND ${taskWriteScopePredicate(actor, sql`task.staff_id`)}
      FOR UPDATE OF task
    `;
    if (!existingRows.length) throw new NotFoundError('Task not found');

    const existing = existingRows[0];
    if (isTerminalTask(existing)) {
      throw new ConflictError('Completed or cancelled tasks must be reopened before their placement can change');
    }
    const nextStaffId = input.staffId ?? existing.staffId;
    const assigneeChanged = nextStaffId !== existing.staffId;
    if (assigneeChanged) {
      await assertActiveStaffResource(nextStaffId, trx);
      if (existing.hoursLogged > 0) {
        throw new ConflictError('Only open tasks without logged time can be reassigned');
      }
    }

    const rows = await trx<TaskRow[]>`
      UPDATE tasks
      SET staff_id = ${nextStaffId}, start_date = ${input.startDate}, due_date = ${input.dueDate},
        updated_by = ${actor.userId}, updated_at = NOW()
      WHERE id = ${id}
      RETURNING id, title, details, category, staff_id,
        (SELECT first_name FROM users WHERE id = tasks.staff_id) AS staff_first_name,
        (SELECT last_name FROM users WHERE id = tasks.staff_id) AS staff_last_name,
        (SELECT CONCAT(first_name, ' ', last_name) FROM users WHERE id = tasks.staff_id) AS staff_name,
        program_id, (SELECT name FROM programs WHERE id = tasks.program_id) AS program_name,
        status, start_date::text, due_date::text, completed_at::text,
        (SELECT COALESCE(SUM(entry.hours), 0)::float FROM time_entries entry WHERE entry.task_id = tasks.id) AS hours_logged
    `;
    updated = rows[0];
    await audit(trx, actor.userId, transactionId, 'tasks', id, 'UPDATE', {
      ...existing,
      staffId: existing.staffId,
    }, {
      ...updated,
      staffId: nextStaffId,
    });
  });

  return attachTaskDetails([updated], await loadTaskLoggedHours([id]), actor)[0];
}

export async function updateTaskStatus(id: string, status: 'open' | 'completed' | 'cancelled', actor: AccessTokenPayload) {
  const transactionId = crypto.randomUUID();
  let updated!: TaskRow;
  await sql.begin(async tx => {
    const trx = asTransactionSql(tx);
    const existingRows = await trx<TaskRow[]>`
      SELECT ${taskRecordColumns}
      ${taskRecordFrom}
      WHERE task.id = ${id}
        AND ${taskWriteScopePredicate(actor, sql`task.staff_id`)}
      FOR UPDATE OF task
    `;
    if (!existingRows.length) throw new NotFoundError('Task not found');
    if (status === 'completed' && existingRows[0].status !== 'open') {
      throw new ConflictError('Only open tasks can be completed');
    }
    if (status === 'completed' && existingRows[0].hoursLogged === 0) {
      throw new ConflictError('Tasks need logged time before they can be completed');
    }
    if (status === 'cancelled' && existingRows[0].status !== 'open') {
      throw new ConflictError('Only open tasks can be cancelled');
    }
    if (status === 'open' && !['completed', 'cancelled'].includes(existingRows[0].status)) {
      throw new ConflictError('Only completed or cancelled tasks can be reopened');
    }
    const rows = await trx<TaskRow[]>`
      UPDATE tasks SET status = ${status},
        completed_at = CASE WHEN ${status} = 'completed' THEN COALESCE(completed_at, NOW()) ELSE NULL END,
        updated_by = ${actor.userId}, updated_at = NOW()
      WHERE id = ${id}
      RETURNING id, title, details, category, staff_id,
        (SELECT first_name FROM users WHERE id = tasks.staff_id) AS staff_first_name,
        (SELECT last_name FROM users WHERE id = tasks.staff_id) AS staff_last_name,
        (SELECT CONCAT(first_name, ' ', last_name) FROM users WHERE id = tasks.staff_id) AS staff_name,
        program_id,
        (SELECT name FROM programs WHERE id = tasks.program_id) AS program_name,
        status, start_date::text, due_date::text, completed_at::text,
        (SELECT COALESCE(SUM(entry.hours), 0)::float FROM time_entries entry WHERE entry.task_id = tasks.id) AS hours_logged
    `;
    updated = rows[0];
    const staffId = existingRows[0].staffId;
    await audit(trx, actor.userId, transactionId, 'tasks', id, 'UPDATE',
      { ...existingRows[0], staffId }, { ...updated, staffId });
  });
  return attachTaskDetails([updated], await loadTaskLoggedHours([id]), actor)[0];
}

export async function deleteTask(id: string, actor: AccessTokenPayload) {
  const transactionId = crypto.randomUUID();
  await sql.begin(async tx => {
    const trx = asTransactionSql(tx);
    const existingRows = await trx<TaskRow[]>`
      SELECT ${taskRecordColumns}
      ${taskRecordFrom}
      WHERE task.id = ${id}
        AND ${taskWriteScopePredicate(actor, sql`task.staff_id`)}
      FOR UPDATE OF task
    `;
    if (!existingRows.length) throw new NotFoundError('Task not found');
    const linkedEntries = await trx<{ exists: boolean }[]>`
      SELECT EXISTS (SELECT 1 FROM time_entries WHERE task_id = ${id}) AS exists
    `;
    if (linkedEntries[0].exists) {
      throw new ConflictError('Tasks with logged time cannot be deleted');
    }
    const staffId = existingRows[0].staffId;
    await trx`DELETE FROM tasks WHERE id = ${id}`;
    await audit(trx, actor.userId, transactionId, 'tasks', id, 'DELETE',
      { ...existingRows[0], staffId }, null);
  });
}

export async function getTaskOptions(actor: AccessTokenPayload) {
  const resources = await sql<{ id: string; firstName: string; lastName: string; name: string; role: string; writable: boolean }[]>`
    SELECT u.id, u.first_name, u.last_name, CONCAT(u.first_name, ' ', u.last_name) AS name, role.name AS role,
      (${taskWriteScopePredicate(actor, sql`u.id`)}) AS writable
    FROM users u
    INNER JOIN user_roles role ON role.id = u.role_id
    INNER JOIN user_credentials credentials ON credentials.user_id = u.id
    WHERE role.name IN ('admin', 'staff')
      AND credentials.status = 'active'
      AND ${taskResourceReadScopePredicate(actor, sql`u.id`)}
    ORDER BY u.first_name, u.last_name, u.id
  `;
  const programs = await sql<{ id: string; name: string }[]>`
    SELECT program.id, program.name
    FROM programs program
    ORDER BY program.name, program.id
  `;
  return { resources, programs };
}

async function updateTaskRecord(id: string, input: SetTaskInput, actor: AccessTokenPayload) {
  assertCanAssignTaskTo(actor, input.staffId);
  const transactionId = crypto.randomUUID();
  let updated!: TaskRow;
  await sql.begin(async tx => {
    const trx = asTransactionSql(tx);
    await assertActiveStaffResource(input.staffId, trx);
    await assertProgramExists(input.programId, trx);
    const existingRows = await trx<TaskRow[]>`
      SELECT ${taskRecordColumns}
      ${taskRecordFrom}
      WHERE task.id = ${id}
        AND ${taskWriteScopePredicate(actor, sql`task.staff_id`)}
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
    const rows = await trx<TaskRow[]>`
      UPDATE tasks
      SET title = ${input.title}, details = ${input.details}, category = ${input.category},
        staff_id = ${input.staffId}, program_id = ${input.programId},
        start_date = ${input.startDate}, due_date = ${input.dueDate},
        updated_by = ${actor.userId}, updated_at = NOW()
      WHERE id = ${id}
      RETURNING id, title, details, category, staff_id,
        (SELECT first_name FROM users WHERE id = tasks.staff_id) AS staff_first_name,
        (SELECT last_name FROM users WHERE id = tasks.staff_id) AS staff_last_name,
        (SELECT CONCAT(first_name, ' ', last_name) FROM users WHERE id = tasks.staff_id) AS staff_name,
        program_id,
        (SELECT name FROM programs WHERE id = tasks.program_id) AS program_name,
        status, start_date::text, due_date::text, completed_at::text,
        (SELECT COALESCE(SUM(entry.hours), 0)::float FROM time_entries entry WHERE entry.task_id = tasks.id) AS hours_logged
    `;
    updated = rows[0];
    await audit(trx, actor.userId, transactionId, 'tasks', id, 'UPDATE', {
      ...existingRows[0], staffId: oldStaffId,
    }, { ...updated, staffId: input.staffId });
  });
  return attachTaskDetails([updated], await loadTaskLoggedHours([id]), actor)[0];
}

function isTerminalTask(task: TaskRow) {
  return task.status === 'completed' || task.status === 'cancelled';
}

async function assertActiveStaffResource(staffId: string, trx: typeof sql) {
  const staff = await trx<{ id: string }[]>`
    SELECT u.id
    FROM users u
    INNER JOIN user_roles role ON role.id = u.role_id
    INNER JOIN user_credentials credentials ON credentials.user_id = u.id
    WHERE u.id = ${staffId}
      AND role.name IN ('admin', 'staff')
      AND credentials.status = 'active'
  `;
  if (!staff.length) throw new NotFoundError('Staff member not found');
}

async function assertProgramExists(programId: string | null, trx: typeof sql) {
  if (programId) {
    const programs = await trx<{ id: string }[]>`SELECT id FROM programs WHERE id = ${programId} LIMIT 1`;
    if (!programs.length) throw new NotFoundError('Program not found');
  }
}
