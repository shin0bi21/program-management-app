import crypto from 'crypto';
import { sql, asTransactionSql } from '../db/client';
import { audit } from './auditService';
import { ConflictError, NotFoundError } from '../errors';
import type { AccessTokenPayload } from '../types/auth';
import type { SetTaskInput, TaskListQuery, TaskPlacementInput, TaskQuery } from '../validation/taskSchemas';
import { assertCanAssignTaskTo, canWriteTaskFor, taskReadScopePredicate, taskResourceReadScopePredicate, taskWriteScopePredicate } from '../policies/taskPolicy';
import { cursorPage, decodeCursor } from './cursorPagination';

interface TaskRow {
  id: string;
  title: string;
  details: string | null;
  category: SetTaskInput['category'];
  staffId: string;
  staffFirstName: string;
  staffLastName: string;
  staffName: string;
  programId: string | null;
  programName: string | null;
  status: 'todo' | 'in_progress' | 'completed' | 'cancelled';
  startDate: string;
  dueDate: string;
  hoursLogged: number;
  completedAt: string | null;
}

interface LoggedHoursRow { taskId: string; workDate: string; hours: number }

function indexLoggedHours(loggedHours: readonly LoggedHoursRow[]) {
  const loggedHoursByTask = new Map<string, Array<{ date: string; hours: number }>>();
  loggedHours.forEach(entry => {
    const taskHours = loggedHoursByTask.get(entry.taskId);
    const dailyHours = { date: entry.workDate, hours: entry.hours };
    if (taskHours) taskHours.push(dailyHours);
    else loggedHoursByTask.set(entry.taskId, [dailyHours]);
  });
  return loggedHoursByTask;
}

async function assertStaffResource(staffId: string, trx: typeof sql) {
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

async function assertTaskResources(input: SetTaskInput, trx: typeof sql) {
  await assertStaffResource(input.staffId, trx);

  if (input.programId) {
    const programs = await trx<{ id: string }[]>`SELECT id FROM programs WHERE id = ${input.programId} LIMIT 1`;
    if (!programs.length) throw new NotFoundError('Program not found');
  }
}

async function loadLoggedHours(taskIds: string[], db: typeof sql = sql) {
  if (!taskIds.length) return [];
  return db<LoggedHoursRow[]>`
    SELECT task_id, work_date::text, SUM(hours)::float AS hours
    FROM time_entries
    WHERE task_id IN ${sql(taskIds)}
    GROUP BY task_id, work_date
    ORDER BY work_date, task_id
  `;
}

function attachDetails<TRow extends TaskRow>(rows: TRow[], loggedHours: LoggedHoursRow[], actor: AccessTokenPayload) {
  const loggedHoursByTask = indexLoggedHours(loggedHours);
  return rows.map(row => ({
    ...row,
    loggedHoursByDate: loggedHoursByTask.get(row.id) ?? [],
    assignee: {
      id: row.staffId,
      firstName: row.staffFirstName,
      lastName: row.staffLastName,
      name: row.staffName,
    },
    writable: canWriteTaskFor(actor, row.staffId),
  }));
}

export async function getTasks(actor: AccessTokenPayload, query: TaskQuery) {
  const rows = await sql<TaskRow[]>`
    SELECT task.id, task.title, task.details, task.category,
      task.staff_id, staff.first_name AS staff_first_name, staff.last_name AS staff_last_name,
      CONCAT(staff.first_name, ' ', staff.last_name) AS staff_name,
      task.program_id, program.name AS program_name,
      task.status, task.start_date::text, task.due_date::text, task.completed_at::text,
      (SELECT COALESCE(SUM(entry.hours), 0)::float FROM time_entries entry WHERE entry.task_id = task.id) AS hours_logged
    FROM tasks task
    INNER JOIN users staff ON staff.id = task.staff_id
    LEFT JOIN programs program ON program.id = task.program_id
    WHERE ${query.staffId ? sql`task.staff_id = ${query.staffId}` : sql`TRUE`}
      AND ${query.start && query.end
        ? sql`task.start_date <= ${query.end}::date AND task.due_date >= ${query.start}::date`
        : sql`TRUE`}
      AND ${taskReadScopePredicate(actor, sql`task.staff_id`)}
      AND ${query.category ? sql`task.category = ${query.category}` : sql`TRUE`}
      AND ${query.includeClosed ? sql`TRUE` : sql`task.status IN ('todo', 'in_progress')`}
    ORDER BY task.start_date, task.due_date, task.title, task.id
  `;
  const taskIds = rows.map(row => row.id);
  return attachDetails(rows, await loadLoggedHours(taskIds), actor);
}

export async function getTaskList(actor: AccessTokenPayload, query: TaskListQuery) {
  const cursor = decodeCursor(query.cursor);
  const direction = query.direction;
  const sortValue = {
    firstName: sql`LOWER(staff.first_name)`, lastName: sql`LOWER(staff.last_name)`, title: sql`LOWER(task.title)`,
    category: sql`task.category::text`, program: sql`LOWER(COALESCE(program.name, ''))`,
    startDate: sql`task.start_date::text`, dueDate: sql`task.due_date::text`, status: sql`task.status::text`,
  }[query.sort]!;
  const search = query.search ? `%${query.search}%` : null;
  const rows = await sql<Array<TaskRow & { cursorValue: string }>>`
    SELECT * FROM (SELECT task.id, task.title, task.details, task.category,
      task.staff_id, staff.first_name AS staff_first_name, staff.last_name AS staff_last_name,
      CONCAT(staff.first_name, ' ', staff.last_name) AS staff_name,
      task.program_id, program.name AS program_name, task.status, task.start_date::text, task.due_date::text,
      task.completed_at::text,
      (SELECT COALESCE(SUM(entry.hours), 0)::float FROM time_entries entry WHERE entry.task_id = task.id) AS hours_logged,
      ${sortValue} AS cursor_value
    FROM tasks task
    INNER JOIN users staff ON staff.id = task.staff_id
    LEFT JOIN programs program ON program.id = task.program_id
    WHERE ${taskReadScopePredicate(actor, sql`task.staff_id`)}
      AND ${query.programIds.length ? sql`(${query.programIds.includes('general') ? sql`task.program_id IS NULL OR` : sql``}
        task.program_id = ANY(${sql.array(query.programIds.filter(id => id !== 'general'))}::uuid[]))` : sql`TRUE`}
      AND ${query.categories.length ? sql`task.category::text = ANY(${sql.array(query.categories)}::text[])` : sql`TRUE`}
      AND ${query.statuses.length ? sql`task.status::text = ANY(${sql.array(query.statuses)}::text[])` : sql`TRUE`}
      AND ${search ? sql`CONCAT_WS(' ', task.title, task.details, program.name, staff.first_name, staff.last_name) ILIKE ${search}` : sql`TRUE`}
    ) listed
    WHERE ${cursor ? (direction === 'asc'
      ? sql`(listed.cursor_value > ${cursor.value} OR (listed.cursor_value = ${cursor.value} AND listed.id > ${cursor.id}::uuid))`
      : sql`(listed.cursor_value < ${cursor.value} OR (listed.cursor_value = ${cursor.value} AND listed.id < ${cursor.id}::uuid))`) : sql`TRUE`}
    ORDER BY listed.cursor_value ${direction === 'asc' ? sql`ASC` : sql`DESC`}, listed.id ${direction === 'asc' ? sql`ASC` : sql`DESC`}
    LIMIT ${(query.limit ?? 25) + 1}
  `;
  const detailed = attachDetails(rows, await loadLoggedHours(rows.map(row => row.id)), actor);
  return cursorPage(detailed, query.limit ?? 25);
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

export async function createTask(input: SetTaskInput, actor: AccessTokenPayload) {
  assertCanAssignTaskTo(actor, input.staffId);
  const transactionId = crypto.randomUUID();
  let created!: TaskRow;
  await sql.begin(async tx => {
    const trx = asTransactionSql(tx);
    await assertTaskResources(input, trx);
    const rows = await trx<TaskRow[]>`
      INSERT INTO tasks (
        title, details, category, staff_id, program_id, status, start_date, due_date, completed_at, created_by, updated_by
      ) VALUES (
        ${input.title}, ${input.details}, ${input.category}, ${input.staffId}, ${input.programId}, 'todo', ${input.startDate}, ${input.dueDate},
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
  return attachDetails([created], [], actor)[0];
}

export async function updateTask(id: string, input: SetTaskInput, actor: AccessTokenPayload) {
  assertCanAssignTaskTo(actor, input.staffId);
  const transactionId = crypto.randomUUID();
  let updated!: TaskRow;
  await sql.begin(async tx => {
    const trx = asTransactionSql(tx);
    await assertTaskResources(input, trx);
    const existingRows = await trx<TaskRow[]>`
      SELECT task.id, task.title, task.details, task.category, task.program_id,
        task.staff_id, staff.first_name AS staff_first_name, staff.last_name AS staff_last_name,
        CONCAT(staff.first_name, ' ', staff.last_name) AS staff_name,
        program.name AS program_name,
        task.status, task.start_date::text, task.due_date::text, task.completed_at::text,
        (SELECT COALESCE(SUM(entry.hours), 0)::float FROM time_entries entry WHERE entry.task_id = task.id) AS hours_logged
      FROM tasks task
      INNER JOIN users staff ON staff.id = task.staff_id
      LEFT JOIN programs program ON program.id = task.program_id
      WHERE task.id = ${id}
        AND ${taskWriteScopePredicate(actor, sql`task.staff_id`)}
      FOR UPDATE OF task
    `;
    if (!existingRows.length) throw new NotFoundError('Task not found');
    const oldStaffId = existingRows[0].staffId;
    const assigneeChanged = oldStaffId !== input.staffId;
    if (assigneeChanged && (existingRows[0].status !== 'todo' || existingRows[0].hoursLogged > 0)) {
      throw new ConflictError('Only to-do tasks without logged time can be reassigned');
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
  return attachDetails([updated], await loadLoggedHours([id]), actor)[0];
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
      SELECT task.id, task.title, task.details, task.category,
        task.staff_id, staff.first_name AS staff_first_name, staff.last_name AS staff_last_name,
        CONCAT(staff.first_name, ' ', staff.last_name) AS staff_name,
        task.program_id, program.name AS program_name,
        task.status, task.start_date::text, task.due_date::text, task.completed_at::text,
        (SELECT COALESCE(SUM(entry.hours), 0)::float FROM time_entries entry WHERE entry.task_id = task.id) AS hours_logged
      FROM tasks task
      INNER JOIN users staff ON staff.id = task.staff_id
      LEFT JOIN programs program ON program.id = task.program_id
      WHERE task.id = ${id}
        AND ${taskWriteScopePredicate(actor, sql`task.staff_id`)}
      FOR UPDATE OF task
    `;
    if (!existingRows.length) throw new NotFoundError('Task not found');

    const existing = existingRows[0];
    const nextStaffId = input.staffId ?? existing.staffId;
    const assigneeChanged = nextStaffId !== existing.staffId;
    if (assigneeChanged) {
      await assertStaffResource(nextStaffId, trx);
      if (existing.status !== 'todo' || existing.hoursLogged > 0) {
        throw new ConflictError('Only to-do tasks without logged time can be reassigned');
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

  return attachDetails([updated], await loadLoggedHours([id]), actor)[0];
}

export async function updateTaskStatus(id: string, status: 'todo' | 'in_progress' | 'completed' | 'cancelled', actor: AccessTokenPayload) {
  const transactionId = crypto.randomUUID();
  let updated!: TaskRow;
  await sql.begin(async tx => {
    const trx = asTransactionSql(tx);
    const existingRows = await trx<TaskRow[]>`
      SELECT task.id, task.title, task.details, task.category,
        task.staff_id, staff.first_name AS staff_first_name, staff.last_name AS staff_last_name,
        CONCAT(staff.first_name, ' ', staff.last_name) AS staff_name,
        task.program_id, program.name AS program_name,
        task.status, task.start_date::text, task.due_date::text, task.completed_at::text,
        (SELECT COALESCE(SUM(entry.hours), 0)::float FROM time_entries entry WHERE entry.task_id = task.id) AS hours_logged
      FROM tasks task
      INNER JOIN users staff ON staff.id = task.staff_id
      LEFT JOIN programs program ON program.id = task.program_id
      WHERE task.id = ${id}
        AND ${taskWriteScopePredicate(actor, sql`task.staff_id`)}
      FOR UPDATE OF task
    `;
    if (!existingRows.length) throw new NotFoundError('Task not found');
    if (status === 'completed' && existingRows[0].status !== 'in_progress') {
      throw new ConflictError('Only in-progress tasks can be completed');
    }
    if (status === 'cancelled' && !['todo', 'in_progress'].includes(existingRows[0].status)) {
      throw new ConflictError('Only open tasks can be cancelled');
    }
    if (status === 'todo' && (existingRows[0].status !== 'cancelled' || existingRows[0].hoursLogged > 0)) {
      throw new ConflictError('Only cancelled tasks without logged time can be reopened as to do');
    }
    if (status === 'in_progress' && !(
      existingRows[0].status === 'completed'
      || (existingRows[0].status === 'cancelled' && existingRows[0].hoursLogged > 0)
    )) {
      throw new ConflictError('Only completed tasks or cancelled tasks with logged time can be reopened as in progress');
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
  return attachDetails([updated], await loadLoggedHours([id]), actor)[0];
}

export async function deleteTask(id: string, actor: AccessTokenPayload) {
  const transactionId = crypto.randomUUID();
  await sql.begin(async tx => {
    const trx = asTransactionSql(tx);
    const existingRows = await trx<TaskRow[]>`
      SELECT task.id, task.title, task.details, task.category,
        task.staff_id, staff.first_name AS staff_first_name, staff.last_name AS staff_last_name,
        CONCAT(staff.first_name, ' ', staff.last_name) AS staff_name,
        task.program_id, program.name AS program_name,
        task.status, task.start_date::text, task.due_date::text, task.completed_at::text,
        (SELECT COALESCE(SUM(entry.hours), 0)::float FROM time_entries entry WHERE entry.task_id = task.id) AS hours_logged
      FROM tasks task
      INNER JOIN users staff ON staff.id = task.staff_id
      LEFT JOIN programs program ON program.id = task.program_id
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
