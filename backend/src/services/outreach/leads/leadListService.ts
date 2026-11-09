import { sql } from '../../../db/client';
import type { LeadQuery } from '../../../validation/leadSchemas';
import { paginateQuery } from '../../shared/cursorPagination';
import { getLeadRows, type LeadRow } from './leadRowQuery';
import { buildLeadFilters } from './leadRowFilters';

/**
 * Lists matching leads.
 * @param filterValues - Validated origin, submitter, status, program, search, and optional cursor inputs.
 * @returns A page of up to 50 rows when limit=50, otherwise all matching canonical lead rows.
 * @example getLeads(filterValues) // { rows, nextCursor } when filterValues.limit is set
 */
export function getLeads(filterValues: LeadQuery) {
  // 1. Find matching leads.
  const appliedFilters = buildLeadFilters(filterValues);
  const rowsQuery = getLeadRows(appliedFilters);

  // 2. Choose the lead order.
  const sortValue = {
    firstName: sql`LOWER("row".youth_first_name)`,
    lastName: sql`LOWER("row".youth_last_name)`,
    school: sql`LOWER("row".school)`,
    program: sql`LOWER(COALESCE("row".recommended_program, ''))`,
    status: sql`"row".status::text`,
    created: sql`"row".created_at::text`,
  }[filterValues.sort]!;

  // 3. Return the requested list or page.
  if (filterValues.limit === undefined) {
    const sortDirection = filterValues.direction === 'asc' ? sql`ASC` : sql`DESC`;
    return sql<LeadRow[]>`
      SELECT "row".*
      FROM (${rowsQuery}) "row"
      ORDER BY ${sortValue} ${sortDirection}, "row".id ${sortDirection}
    `;
  }

  return paginateQuery(rowsQuery, {
    sortValue,
    direction: filterValues.direction,
    cursor: filterValues.cursor,
  });
}
