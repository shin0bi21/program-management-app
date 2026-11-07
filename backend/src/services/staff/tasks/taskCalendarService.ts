import { sql } from '../../../db/client';
import { taskReadScopePredicate } from '../../../policies/taskPolicy';
import type { AccessTokenPayload } from '../../../types/auth';
import type { TaskCalendarQuery } from '../../../validation/taskSchemas';
import { buildTaskFilters, resolveTaskDateRange } from './taskRowFilters';
import {
  attachTaskDetails,
  loadTaskLoggedHours,
  getTaskRows,
  type TaskRow,
} from './taskRowQuery';

/**
 * Loads accessible tasks overlapping the requested calendar range.
 * @param actor - Actor whose staff scope limits the rows.
 * @param query - Validated date and task filters.
 * @example getTasksCalendarData(actor, query) // complete matching tasks
 */
export async function getTasksCalendarData(
  actor: AccessTokenPayload,
  query: TaskCalendarQuery,
) {
  // 1. Find the requested dates.
  const range = await resolveTaskDateRange(query);
  if (!range) return [];

  // 2. Load matching tasks.
  const { appliedFilters } = buildTaskFilters(query);
  const rows = await sql<TaskRow[]>`
    ${getTaskRows(sql`
      task.start_date <= ${range.end}::date
      AND task.due_date >= ${range.start}::date
      AND ${taskReadScopePredicate(actor, sql`task.staff_id`)}
      AND ${appliedFilters}
    `)}
    ORDER BY task.start_date, task.due_date, task.title, task.id
  `;

  // 3. Add logged hours and task access.
  return attachTaskDetails(rows, await loadTaskLoggedHours(rows.map(row => row.id)), actor);
}
