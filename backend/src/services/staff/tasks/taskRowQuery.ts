import { sql } from '../../../db/client';
import { canWriteTaskFor, taskReadScopePredicate } from '../../../policies/taskPolicy';
import type { AccessTokenPayload } from '../../../types/auth';
import type { SetTaskInput } from '../../../validation/taskSchemas';
import {
  getTaskCategoryLabel,
  getTaskStatus,
  getTaskStatusLabel,
} from './taskReferenceData';

export interface TaskRow {
  id: string;
  title: string;
  details: string | null;
  category: SetTaskInput['category'];
  staffId: string;
  firstName: string;
  lastName: string;
  name: string;
  programId: string | null;
  program: string | null;
  state: 'open' | 'completed' | 'cancelled';
  startDate: string;
  dueDate: string;
  hoursLogged: number;
  completedAt: string | null;
}

interface LoggedHoursRow { taskId: string; date: string; hours: number }

/**
 * Builds canonical task rows within the actor's readable staff scope.
 * @param actor - Actor whose resource scope is always enforced.
 * @param appliedFilters - SQL filters supplied by the service.
 * @param query - Database client; pass trx inside a transaction.
 * @example getTaskRows(actor, appliedFilters, trx)
 */
export function getTaskRows(actor: AccessTokenPayload, appliedFilters = sql`TRUE`, query = sql) {
  return query<TaskRow[]>`
    SELECT
      task.id,
      task.title,
      task.details,
      task.category,
      task.staff_id,
      staff.first_name,
      staff.last_name,
      CONCAT(staff.first_name, ' ', staff.last_name) AS name,
      task.program_id,
      program.name AS program,
      task.state,
      task.start_date::text,
      task.due_date::text,
      task.completed_at::text,
      (
        SELECT COALESCE(SUM(entry.hours), 0)::float
        FROM time_entries entry
        WHERE entry.task_id = task.id
      ) AS hours_logged
    FROM tasks task
    INNER JOIN users staff ON staff.id = task.staff_id
    LEFT JOIN programs program ON program.id = task.program_id
    WHERE ${taskReadScopePredicate(actor, query`task.staff_id`)}
      AND (${appliedFilters})
  `;
}

/**
 * Loads daily logged hours for the selected tasks.
 * @param taskIds - Tasks to load.
 * @param query - Database client; pass trx inside a transaction.
 * @example loadTaskLoggedHours([taskId])
 */
export async function loadTaskLoggedHours(taskIds: string[], query: typeof sql = sql) {
  if (!taskIds.length) return [];
  return query<LoggedHoursRow[]>`
    SELECT task_id, date::text, SUM(hours)::float AS hours
    FROM time_entries
    WHERE task_id IN ${query(taskIds)}
    GROUP BY task_id, date
    ORDER BY date, task_id
  `;
}

/**
 * Adds logged hours, labels, and access to task rows.
 * @param rows - Task rows to shape.
 * @param loggedHours - Daily totals for those tasks.
 * @param actor - User viewing the tasks.
 * @example attachTaskDetails(rows, loggedHours, actor)
 */
export function attachTaskDetails<TRow extends TaskRow>(
  rows: TRow[],
  loggedHours: LoggedHoursRow[],
  actor: AccessTokenPayload,
) {
  const loggedHoursByTask = new Map<string, Array<{ date: string; hours: number }>>();
  loggedHours.forEach(entry => {
    const taskHours = loggedHoursByTask.get(entry.taskId);
    const dailyHours = { date: entry.date, hours: entry.hours };
    if (taskHours) taskHours.push(dailyHours);
    else loggedHoursByTask.set(entry.taskId, [dailyHours]);
  });

  return rows.map(row => {
    const status = getTaskStatus(row);
    return {
      ...row,
      categoryLabel: getTaskCategoryLabel(row.category),
      status,
      statusLabel: getTaskStatusLabel(status),
      loggedHoursByDate: loggedHoursByTask.get(row.id) ?? [],
      writable: canWriteTaskFor(actor, row.staffId),
    };
  });
}
