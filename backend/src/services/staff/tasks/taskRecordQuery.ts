import { sql } from '../../../db/client';
import { canWriteTaskFor } from '../../../policies/taskPolicy';
import type { AccessTokenPayload } from '../../../types/auth';
import type { SetTaskInput } from '../../../validation/taskSchemas';

export interface TaskRow {
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

/** Canonical task fields shared by collection and direct-record reads. */
export const taskRecordColumns = sql`
  task.id,
  task.title,
  task.details,
  task.category,
  task.staff_id,
  staff.first_name AS staff_first_name,
  staff.last_name AS staff_last_name,
  CONCAT(staff.first_name, ' ', staff.last_name) AS staff_name,
  task.program_id,
  program.name AS program_name,
  task.status,
  task.start_date::text,
  task.due_date::text,
  task.completed_at::text,
  (SELECT COALESCE(SUM(entry.hours), 0)::float
   FROM time_entries entry
   WHERE entry.task_id = task.id) AS hours_logged
`;

/** Canonical task relationships shared by collection and direct-record reads. */
export const taskRecordFrom = sql`
  FROM tasks task
  INNER JOIN users staff ON staff.id = task.staff_id
  LEFT JOIN programs program ON program.id = task.program_id
`;

interface LoggedHoursRow { taskId: string; workDate: string; hours: number }

export async function loadTaskLoggedHours(taskIds: string[], db: typeof sql = sql) {
  if (!taskIds.length) return [];
  return db<LoggedHoursRow[]>`
    SELECT task_id, work_date::text, SUM(hours)::float AS hours
    FROM time_entries
    WHERE task_id IN ${sql(taskIds)}
    GROUP BY task_id, work_date
    ORDER BY work_date, task_id
  `;
}

export function attachTaskDetails<TRow extends TaskRow>(
  rows: TRow[],
  loggedHours: LoggedHoursRow[],
  actor: AccessTokenPayload,
) {
  const loggedHoursByTask = new Map<string, Array<{ date: string; hours: number }>>();
  loggedHours.forEach(entry => {
    const taskHours = loggedHoursByTask.get(entry.taskId);
    const dailyHours = { date: entry.workDate, hours: entry.hours };
    if (taskHours) taskHours.push(dailyHours);
    else loggedHoursByTask.set(entry.taskId, [dailyHours]);
  });

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
