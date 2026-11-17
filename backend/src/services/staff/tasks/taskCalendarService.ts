import { sql } from '../../../db/client';
import type { AccessTokenPayload } from '../../../types/auth';
import type { TaskCalendarQuery } from '../../../validation/taskSchemas';
import { buildTaskFilters, resolveTaskDateRange } from './taskRowFilters';
import { getTaskRows, type TaskRow } from './taskRowQuery';

/**
 * Loads accessible tasks overlapping the requested calendar range.
 * @param user - User whose staff scope limits the rows.
 * @param query - Validated date and task filters.
 * @example getTasksCalendarData(user, query) // complete matching tasks
 */
export async function getTasksCalendarData(
  user: AccessTokenPayload,
  query: TaskCalendarQuery,
) {
  // 1. Find the requested dates.
  const range = await resolveTaskDateRange(query);
  if (!range) return [];

  // 2. Load matching tasks.
  const appliedFilters = buildTaskFilters(query);
  return sql<TaskRow[]>`
    ${getTaskRows(user, sql`
      task.start_date <= ${range.end}::date
      AND task.due_date >= ${range.start}::date
      AND ${appliedFilters}
    `)}
    ORDER BY task.start_date, task.due_date, task.title, task.id
  `;
}
