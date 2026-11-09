import { sql } from '../../../db/client';
import type { AccessTokenPayload } from '../../../types/auth';
import type { HoursTableQuery } from '../../../validation/hoursSchemas';
import { paginateQuery } from '../../shared/cursorPagination';
import { buildHoursFilters } from './hoursRowFilters';
import { getHoursRows } from './hoursRowQuery';

/**
 * Lists matching hours entries.
 * @param actor - Actor whose staff scope constrains the hours collection.
 * @param filterValues - Validated domain/date filters, sorting, and cursor inputs.
 * @returns A bounded page with numeric hours and canonical entry details.
 * @example getHoursList(actor, filterValues) // { rows, nextCursor }
 */
export function getHoursList(actor: AccessTokenPayload, filterValues: HoursTableQuery) {
  // 1. Filter canonical hours rows by the selected values and inclusive dates.
  const appliedFilters = sql`
    ${buildHoursFilters(filterValues)}
    AND ${filterValues.start && filterValues.end
      ? sql`entry.date BETWEEN ${filterValues.start}::date AND ${filterValues.end}::date`
      : sql`TRUE`}
  `;
  const rowsQuery = getHoursRows(actor, appliedFilters);

  // 2. Sort and paginate the complete rows using the selected field.
  const sortValue = {
    firstName: sql`LOWER("row".first_name)`,
    lastName: sql`LOWER("row".last_name)`,
    date: sql`"row".date`,
    program: sql`LOWER(COALESCE("row".program, ''))`,
    cycle: sql`LOWER("row".cycle)`,
    category: sql`"row".category::text`,
    hours: sql`"row".hours`,
    note: sql`LOWER("row".note)`,
    type: sql`"row".type`,
  }[filterValues.sort]!;

  return paginateQuery(rowsQuery, {
    sortValue,
    direction: filterValues.direction,
    cursor: filterValues.cursor,
  });
}
