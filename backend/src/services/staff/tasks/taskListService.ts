import { sql } from '../../../db/client';
import type { AccessTokenPayload } from '../../../types/auth';
import type { TaskListQuery } from '../../../validation/taskSchemas';
import { paginateQuery } from '../../shared/cursorPagination';
import { getTaskRows } from './taskRowQuery';
import { buildTaskFilters, resolveTaskDateRange } from './taskRowFilters';

/**
 * Lists matching tasks.
 * @param user - User whose staff scope controls reads and per-row write capabilities.
 * @param filterValues - Validated task filters, derived-status sorting, and cursor inputs.
 * @returns A bounded page with logged-hour details; unavailable or disjoint date bounds return an empty page.
 * @example getTaskList(user, filterValues) // { rows, nextCursor }
 */
export async function getTaskList(user: AccessTokenPayload, filterValues: TaskListQuery) {
  // 1. Load the matching tasks.
  const range = await resolveTaskDateRange(filterValues);
  const appliedFilters = buildTaskFilters(filterValues);
  const dateFilter = range
    ? sql`task.start_date <= ${range.end}::date AND task.due_date >= ${range.start}::date`
    : sql`FALSE`;
  const rowsQuery = getTaskRows(user, sql`
    ${appliedFilters}
    AND ${dateFilter}
  `);

  // 2. Choose the order and load the page.
  const sortValue = {
    firstName: sql`LOWER("row".first_name)`,
    lastName: sql`LOWER("row".last_name)`,
    title: sql`LOWER("row".title)`,
    category: sql`"row".category::text`,
    program: sql`LOWER("row".program)`,
    startDate: sql`"row".start_date`,
    dueDate: sql`"row".due_date`,
    status: sql`"row".status`,
  }[filterValues.sort]!;

  return paginateQuery(rowsQuery, {
    sortValue,
    direction: filterValues.direction,
    cursor: filterValues.cursor,
  });
}
