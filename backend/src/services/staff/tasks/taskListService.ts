import { sql } from '../../../db/client';
import { taskReadScopePredicate } from '../../../policies/taskPolicy';
import type { AccessTokenPayload } from '../../../types/auth';
import type { TaskListQuery } from '../../../validation/taskSchemas';
import { paginateQuery, BATCH_SIZE } from '../../shared/cursorPagination';
import {
  attachTaskDetails,
  loadTaskLoggedHours,
  getTaskRows,
} from './taskRowQuery';
import { buildTaskFilters, resolveTaskDateRange } from './taskRowFilters';

/**
 * Lists matching tasks.
 * @param actor - Actor whose staff scope controls reads and per-row write capabilities.
 * @param filterValues - Validated task filters, derived-status sorting, and cursor inputs.
 * @returns A bounded page with logged-hour details; unavailable or disjoint date bounds return an empty page.
 * @example getTaskList(actor, filterValues) // { rows, nextCursor }
 */
export async function getTaskList(actor: AccessTokenPayload, filterValues: TaskListQuery) {
  // 1. Load the matching tasks.
  const range = await resolveTaskDateRange(filterValues);
  const { status, appliedFilters } = buildTaskFilters(filterValues);
  const dateFilter = range
    ? sql`task.start_date <= ${range.end}::date AND task.due_date >= ${range.start}::date`
    : sql`FALSE`;
  const rowsQuery = getTaskRows(sql`
    ${taskReadScopePredicate(actor, sql`task.staff_id`)}
    AND ${appliedFilters}
    AND ${dateFilter}
  `);

  // 2. Choose the order and load the page.
  const sortValue = {
    firstName: sql`LOWER("row".first_name)`,
    lastName: sql`LOWER("row".last_name)`,
    title: sql`LOWER("row".title)`,
    category: sql`"row".category::text`,
    program: sql`LOWER(COALESCE("row".program, ''))`,
    startDate: sql`"row".start_date`,
    dueDate: sql`"row".due_date`,
    status,
  }[filterValues.sort]!;
  const page = await paginateQuery(rowsQuery, {
    sortValue,
    direction: filterValues.direction,
    cursor: filterValues.cursor,
    limit: filterValues.limit ?? BATCH_SIZE,
  });

  // 3. Add details for the visible tasks.
  const rows = page.rows;
  const loggedHours = await loadTaskLoggedHours(rows.map(row => row.id));
  return { ...page, rows: attachTaskDetails(rows, loggedHours, actor) };
}
