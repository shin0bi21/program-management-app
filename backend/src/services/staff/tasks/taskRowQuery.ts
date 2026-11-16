import { sql } from '../../../db/client';
import { taskReadScopePredicate, taskWriteScopePredicate } from '../../../policies/taskPolicy';
import type { AccessTokenPayload } from '../../../types/auth';
import type { SetTaskInput } from '../../../validation/taskSchemas';
import {
  TASK_CATEGORY_OPTIONS,
  TASK_STATUS_OPTIONS,
  type TaskStatus,
} from './taskReferenceData';

export interface TaskRow {
  id: string;
  title: string;
  details: string | null;
  category: SetTaskInput['category'];
  state: 'open' | 'completed' | 'cancelled';
  startDate: string;
  dueDate: string;
  staffId: string;
  programId: string | null;
  completedAt: string | null;

  firstName: string;
  lastName: string;

  program: string | null;

  categoryLabel: string;
  status: TaskStatus;
  statusLabel: string;
  hoursLogged: number;
  loggedHoursByDate: Array<{ date: string; hours: number }>;
  writable: boolean;
}

const categoryLabels = Object.fromEntries(TASK_CATEGORY_OPTIONS.map(option => [option.id, option.name]));
const statusLabels = Object.fromEntries(TASK_STATUS_OPTIONS.map(option => [option.id, option.name]));

/** Displayed task status shared by the canonical projection, filters, and sorting. */
export const taskStatus = sql`
  CASE
    WHEN task.state <> 'open' THEN task.state
    WHEN task.start_date > CURRENT_DATE THEN 'upcoming'
    WHEN task.due_date < CURRENT_DATE THEN 'overdue'
    ELSE 'in_progress'
  END
`;

/**
 * Builds canonical task rows within the actor's readable staff scope.
 * @param actor - Actor whose staff scope is always enforced.
 * @param appliedFilters - SQL filters supplied by the service.
 * @param query - Database client; pass trx inside a transaction.
 * @returns Complete rows with labels, numeric totals, date-ordered daily hours, and policy-derived write access.
 * @example getTaskRows(actor, appliedFilters, trx)
 */
export function getTaskRows(actor: AccessTokenPayload, appliedFilters = sql`TRUE`, query = sql) {
  // 1. Read complete task records within the actor's staff scope.
  return query<TaskRow[]>`
    SELECT
      task.id,
      task.title,
      task.details,
      task.category,
      task.state,
      task.start_date,
      task.due_date,
      task.staff_id,
      task.program_id,
      task.completed_at,

      staff.first_name,
      staff.last_name,

      program.title AS program,

      ${query.json(categoryLabels)}::jsonb ->> task.category AS category_label,
      ${taskStatus} AS status,
      ${query.json(statusLabels)}::jsonb ->> (${taskStatus}) AS status_label,
      (
        SELECT COALESCE(SUM(entry.hours), 0)::double precision
        FROM time_entries entry
        WHERE entry.task_id = task.id
      ) AS hours_logged,
      (
        SELECT COALESCE(json_agg(
          json_build_object('date', daily.date, 'hours', daily.hours)
          ORDER BY daily.date
        ), '[]'::json)
        FROM (
          SELECT
            entry.date,
            SUM(entry.hours)::double precision AS hours
          FROM time_entries entry
          WHERE entry.task_id = task.id
          GROUP BY entry.date
        ) daily
      ) AS logged_hours_by_date,
      ${taskWriteScopePredicate(actor, query`task.staff_id`)} AS writable
    FROM tasks task
    INNER JOIN users staff ON staff.id = task.staff_id
    LEFT JOIN programs program ON program.id = task.program_id
    WHERE ${taskReadScopePredicate(actor, query`task.staff_id`)}
      AND (${appliedFilters})
  `;
}
