import { sql } from '../../../db/client';
import { hoursReadScopePredicate } from '../../../policies/hoursPolicy';
import type { AccessTokenPayload } from '../../../types/auth';
import type { HoursTableQuery } from '../../../validation/hoursSchemas';
import { paginateQuery, BATCH_SIZE } from '../../shared/cursorPagination';
import { buildHoursFilters } from './hoursRowFilters';
import {
  getHoursRows,
  hoursRowToTableRow,
} from './hoursRowQuery';

/**
 * Lists matching hours entries.
 * @param actor - Actor whose staff scope constrains the hours collection.
 * @param filterValues - Validated domain/date filters, sorting, and cursor inputs.
 * @returns A bounded page with numeric hours and canonical entry details.
 * @example getHoursList(actor, filterValues) // { rows, nextCursor }
 */
export async function getHoursList(actor: AccessTokenPayload, filterValues: HoursTableQuery) {
  // 1. Apply staff scope, domain filters, and inclusive dates to canonical hours rows.
  const appliedFilters = sql`
    ${hoursReadScopePredicate(actor, sql`entry.staff_id`)}
      ${buildHoursFilters(filterValues)}
      AND ${filterValues.start && filterValues.end
        ? sql`entry.work_date BETWEEN ${filterValues.start}::date AND ${filterValues.end}::date`
        : sql`TRUE`}
  `;
  const rowsQuery = getHoursRows(appliedFilters);

  // 2. Keep numeric hours order encoded as text for existing cursor compatibility.
  const entryType = sql`
    CASE
      WHEN page_row.task_id IS NOT NULL THEN 'task'
      WHEN page_row.session_id IS NOT NULL THEN 'session'
      ELSE 'other'
    END
  `;

  const sortValue = {
    firstName: sql`LOWER(page_row.staff_first_name)`,
    lastName: sql`LOWER(page_row.staff_last_name)`,
    date: sql`page_row.work_date`,
    program: sql`LOWER(COALESCE(page_row.program_name, ''))`,
    cycle: sql`LOWER(page_row.cycle_name)`,
    category: sql`page_row.category::text`,
    hours: sql`TO_CHAR(page_row.hours::numeric, 'FM0000000000.0000')`,
    note: sql`LOWER(page_row.note)`,
    type: entryType,
  }[filterValues.sort]!;
  const page = await paginateQuery(rowsQuery, {
    sortValue,
    direction: filterValues.direction,
    cursor: filterValues.cursor,
    limit: filterValues.limit ?? BATCH_SIZE,
  });

  // 3. Shape visible entries without changing the SQL-derived continuation cursor.
  return { ...page, rows: page.rows.map(hoursRowToTableRow) };
}
