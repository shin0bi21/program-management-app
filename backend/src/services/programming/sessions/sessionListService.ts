import { sql } from '../../../db/client';
import type { AccessTokenPayload } from '../../../types/auth';
import type { SessionListQuery } from '../../../validation/programmingSchemas';
import { paginateQuery } from '../../shared/cursorPagination';
import { getSessionRows, type SessionRow } from './sessionRowQuery';
import { buildSessionFilters } from './sessionRowFilters';

/**
 * Lists matching sessions.
 * @param actor - Actor whose program access scopes the rows; callers enforce route permissions.
 * @param filterValues - Validated list filters; unpaged calendar ranges default to ascending order.
 * @returns A page of up to 50 rows when paginate=true, otherwise the complete matching rows.
 * @example listSessions(actor, filterValues) // { rows, nextCursor } when filterValues.paginate is set
 */
export function listSessions(actor: AccessTokenPayload, filterValues: SessionListQuery) {
  // 1. Filter the canonical, access-scoped session rows.
  const filteredRows = buildSessionFilters(getSessionRows(actor), filterValues);
  const direction = filterValues.paginate === undefined && filterValues.start ? 'asc' : filterValues.direction;

  // 2. Choose the session sort and delegate cursor execution and response shaping.
  const sortValue = {
    program: sql`LOWER("row".program)`,
    cycle: sql`LOWER("row".cycle)`,
    title: sql`LOWER("row".title)`,
    date: sql`"row".date`,
    time: sql`"row".start_time`,
    type: sql`LOWER("row".session_type::text)`,
    status: sql`"row".state`,
  }[filterValues.sort]!;

  // 3. Keep complete lookups separate from bounded cursor pages.
  if (filterValues.paginate === undefined) {
    const sortDirection = direction === 'asc' ? sql`ASC` : sql`DESC`;
    return sql<SessionRow[]>`
      SELECT "row".*
      FROM (${filteredRows}) "row"
      ORDER BY ${sortValue} ${sortDirection} NULLS LAST, "row".id ${sortDirection}
    `;
  }

  return paginateQuery(filteredRows, {
    sortValue,
    direction,
    cursor: filterValues.cursor,
  });
}
