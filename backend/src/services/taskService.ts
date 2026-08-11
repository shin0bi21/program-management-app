import crypto from 'crypto';
import { sql, asTransactionSql } from '../db/client';
import { audit } from './auditService';
import { ConflictError, NotFoundError } from '../errors';
import type { AccessTokenPayload } from '../types/auth';
import type { SetTaskInput, TaskPlacementInput, TaskQuery } from '../validation/taskSchemas';
import { assertCanAssignTaskTo, canWriteTaskFor, taskReadScopePredicate, taskResourceReadScopePredicate, taskWriteScopePredicate } from '../policies/taskPolicy';

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
  cycleId: string;
  cycleName: string;
  status: SetTaskInput['status'];
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
  const cycles = await trx<{ id: string }[]>`
    SELECT cycle.id
    FROM program_cycles cycle
    WHERE cycle.id = ${input.cycleId}
      AND ${input.programId ? sql`EXISTS (
        SELECT 1 FROM program_cohorts cohort
        WHERE cohort.program_id = ${input.programId} AND cohort.cycle_id = cycle.id
      )` : sql`TRUE`}
    LIMIT 1
  `;
  if (!cycles.length) throw new NotFoundError(input.programId ? 'Cycle not found for selected program' : 'Cycle not found');
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

function attachDetails(rows: TaskRow[], loggedHours: LoggedHoursRow[], actor: AccessTokenPayload) {
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
      task.cycle_id, cycle.name AS cycle_name,
      task.status, task.start_date::text, task.due_date::text, task.completed_at::text,
      (SELECT COALESCE(SUM(entry.hours), 0)::float FROM time_entries entry WHERE entry.task_id = task.id) AS hours_logged
    FROM tasks task
    INNER JOIN users staff ON staff.id = task.staff_id
    LEFT JOIN programs program ON program.id = task.program_id
    LEFT JOIN program_cycles cycle ON cycle.id = task.cycle_id
    WHERE ${query.staffId ? sql`task.staff_id = ${query.staffId}` : sql`TRUE`}
      AND ${taskReadScopePredicate(actor, sql`task.staff_id`)}
      AND ${query.category ? sql`task.category = ${query.category}` : sql`TRUE`}
      AND ${query.includeClosed ? sql`TRUE` : sql`task.status IN ('todo', 'in_progress')`}
    ORDER BY task.start_date, task.due_date, task.title, task.id
  `;
  const taskIds = rows.map(row => row.id);
  return attachDetails(rows, await loadLoggedHours(taskIds), actor);
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
  const cycles = await sql<{ id: string; name: string; programId: string; startsOn: string; endsOn: string; state: string }[]>`
    SELECT DISTINCT cycle.id, cycle.name, cohort.program_id,
      cycle.starts_on::text, cycle.ends_on::text,
      CASE
        WHEN CURRENT_DATE < cycle.starts_on THEN 'upcoming'
        WHEN CURRENT_DATE > cycle.ends_on THEN 'completed'
        ELSE 'active'
      END AS state
    FROM program_cycles cycle
    INNER JOIN program_cohorts cohort ON cohort.cycle_id = cycle.id
    ORDER BY cycle.name, cycle.id, cohort.program_id
  `;
  return { resources, programs, cycles };
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
        title, details, category, staff_id, program_id, cycle_id, status, start_date, due_date, completed_at, created_by, updated_by
      ) VALUES (
        ${input.title}, ${input.details}, ${input.category}, ${input.staffId}, ${input.programId}, ${input.cycleId}, ${input.status}, ${input.startDate}, ${input.dueDate},
        ${input.status === 'completed' ? sql`NOW()` : null}, ${actor.userId}, ${actor.userId}
      )
      RETURNING id, title, details, category, staff_id,
        (SELECT first_name FROM users WHERE id = tasks.staff_id) AS staff_first_name,
        (SELECT last_name FROM users WHERE id = tasks.staff_id) AS staff_last_name,
        (SELECT CONCAT(first_name, ' ', last_name) FROM users WHERE id = tasks.staff_id) AS staff_name,
        program_id,
        (SELECT name FROM programs WHERE id = tasks.program_id) AS program_name,
        cycle_id, (SELECT name FROM program_cycles WHERE id = tasks.cycle_id) AS cycle_name,
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
        program.name AS program_name, task.cycle_id, cycle.name AS cycle_name,
        task.status, task.start_date::text, task.due_date::text, task.completed_at::text,
        (SELECT COALESCE(SUM(entry.hours), 0)::float FROM time_entries entry WHERE entry.task_id = task.id) AS hours_logged
      FROM tasks task
      INNER JOIN users staff ON staff.id = task.staff_id
      LEFT JOIN programs program ON program.id = task.program_id
      LEFT JOIN program_cycles cycle ON cycle.id = task.cycle_id
      WHERE task.id = ${id}
        AND ${taskWriteScopePredicate(actor, sql`task.staff_id`)}
      FOR UPDATE OF task
    `;
    if (!existingRows.length) throw new NotFoundError('Task not found');
    if (existingRows[0].status === 'in_progress' && input.status === 'cancelled') {
      throw new ConflictError('In-progress tasks cannot be cancelled');
    }
    const oldStaffId = existingRows[0].staffId;
    const assigneeChanged = oldStaffId !== input.staffId;
    if (assigneeChanged && (existingRows[0].status !== 'todo' || existingRows[0].hoursLogged > 0)) {
      throw new ConflictError('Only to-do tasks without logged time can be reassigned');
    }
    const rows = await trx<TaskRow[]>`
      UPDATE tasks
      SET title = ${input.title}, details = ${input.details}, category = ${input.category},
        staff_id = ${input.staffId}, program_id = ${input.programId}, cycle_id = ${input.cycleId}, status = ${input.status},
        start_date = ${input.startDate}, due_date = ${input.dueDate},
        completed_at = CASE WHEN ${input.status} = 'completed' THEN COALESCE(completed_at, NOW()) ELSE NULL END,
        updated_by = ${actor.userId}, updated_at = NOW()
      WHERE id = ${id}
      RETURNING id, title, details, category, staff_id,
        (SELECT first_name FROM users WHERE id = tasks.staff_id) AS staff_first_name,
        (SELECT last_name FROM users WHERE id = tasks.staff_id) AS staff_last_name,
        (SELECT CONCAT(first_name, ' ', last_name) FROM users WHERE id = tasks.staff_id) AS staff_name,
        program_id,
        (SELECT name FROM programs WHERE id = tasks.program_id) AS program_name,
        cycle_id, (SELECT name FROM program_cycles WHERE id = tasks.cycle_id) AS cycle_name,
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
        task.cycle_id, cycle.name AS cycle_name,
        task.status, task.start_date::text, task.due_date::text, task.completed_at::text,
        (SELECT COALESCE(SUM(entry.hours), 0)::float FROM time_entries entry WHERE entry.task_id = task.id) AS hours_logged
      FROM tasks task
      INNER JOIN users staff ON staff.id = task.staff_id
      LEFT JOIN programs program ON program.id = task.program_id
      LEFT JOIN program_cycles cycle ON cycle.id = task.cycle_id
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
        cycle_id, (SELECT name FROM program_cycles WHERE id = tasks.cycle_id) AS cycle_name,
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

export async function updateTaskStatus(id: string, status: SetTaskInput['status'], actor: AccessTokenPayload) {
  const transactionId = crypto.randomUUID();
  let updated!: TaskRow;
  await sql.begin(async tx => {
    const trx = asTransactionSql(tx);
    const existingRows = await trx<TaskRow[]>`
      SELECT task.id, task.title, task.details, task.category,
        task.staff_id, staff.first_name AS staff_first_name, staff.last_name AS staff_last_name,
        CONCAT(staff.first_name, ' ', staff.last_name) AS staff_name,
        task.program_id, program.name AS program_name,
        task.cycle_id, cycle.name AS cycle_name,
        task.status, task.start_date::text, task.due_date::text, task.completed_at::text,
        (SELECT COALESCE(SUM(entry.hours), 0)::float FROM time_entries entry WHERE entry.task_id = task.id) AS hours_logged
      FROM tasks task
      INNER JOIN users staff ON staff.id = task.staff_id
      LEFT JOIN programs program ON program.id = task.program_id
      LEFT JOIN program_cycles cycle ON cycle.id = task.cycle_id
      WHERE task.id = ${id}
        AND ${taskWriteScopePredicate(actor, sql`task.staff_id`)}
      FOR UPDATE OF task
    `;
    if (!existingRows.length) throw new NotFoundError('Task not found');
    if (existingRows[0].status === 'in_progress' && status === 'cancelled') {
      throw new ConflictError('In-progress tasks cannot be cancelled');
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
        cycle_id, (SELECT name FROM program_cycles WHERE id = tasks.cycle_id) AS cycle_name,
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
        task.cycle_id, cycle.name AS cycle_name,
        task.status, task.start_date::text, task.due_date::text, task.completed_at::text,
        (SELECT COALESCE(SUM(entry.hours), 0)::float FROM time_entries entry WHERE entry.task_id = task.id) AS hours_logged
      FROM tasks task
      INNER JOIN users staff ON staff.id = task.staff_id
      LEFT JOIN programs program ON program.id = task.program_id
      LEFT JOIN program_cycles cycle ON cycle.id = task.cycle_id
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
