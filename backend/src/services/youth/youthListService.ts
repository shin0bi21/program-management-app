import { sql } from '../../db/client';
import type { YouthQuery } from '../../validation/youthSchemas';
import { paginateQuery } from '../shared/cursorPagination';
import { buildYouthFilters } from './youthRowFilters';
import { getYouthRows, type YouthRow } from './youthRowQuery';

/**
 * Lists matching youth profiles.
 * @param filterValues - Selected programs, cycles, search text, and sorting after request validation; paginate requests a page.
 * @returns A page of up to 50 rows when paginate=true, otherwise all matching youth rows in the requested order.
 * @example listYouth(filterValues) // { rows, nextCursor } when filterValues.paginate is set
 */
export function listYouth(filterValues: YouthQuery) {
  // 1. Restrict the canonical profile query to youth and the requested filters.
  const appliedFilters = buildYouthFilters(filterValues);
  const rowsQuery = getYouthRows(appliedFilters);

  // 2. Keep list-only sort calculations outside the canonical profile projection.
  const sortValue = {
    firstName: sql`LOWER("row".first_name)`,
    lastName: sql`LOWER("row".last_name)`,
    dateOfBirth: sql`"row".date_of_birth`,
    school: sql`LOWER("row".school_name)`,
    activeProgram: sql`LOWER("row".active_program->>'program')`,
  }[filterValues.sort]!;

  // 3. Return the requested list or page.
  if (filterValues.paginate === undefined) {
    const sortDirection = filterValues.direction === 'asc' ? sql`ASC` : sql`DESC`;
    return sql<YouthRow[]>`
      SELECT "row".*
      FROM (${rowsQuery}) "row"
      ORDER BY ${sortValue} ${sortDirection} NULLS LAST, "row".id ${sortDirection}
    `;
  }

  return paginateQuery(rowsQuery, {
    sortValue,
    direction: filterValues.direction,
    cursor: filterValues.cursor,
  });
}
