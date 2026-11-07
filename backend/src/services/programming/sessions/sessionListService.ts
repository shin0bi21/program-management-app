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
 * @returns A cursor page when a limit is supplied, otherwise the complete matching rows.
 * @example listSessions(actor, filterValues) // { rows, nextCursor } when filterValues.limit is set
 */
export function listSessions(actor: AccessTokenPayload, filterValues: SessionListQuery) {
  // 1. Filter the canonical, access-scoped session rows.
  const filteredRows = buildSessionFilters(getSessionRows(actor), filterValues);
  const direction = !filterValues.limit && filterValues.start ? 'asc' : filterValues.direction;

  // 2. Choose the session sort and delegate cursor execution and response shaping.
  const sortValue = {
    program: sql`LOWER("row".program)`,
    cycle: sql`LOWER("row".cycle)`,
    theme: sql`LOWER(COALESCE("row".theme, ''))`,
    date: sql`"row".starts_at::text`,
    time: sql`"row".starts_at::text`,
    type: sql`LOWER("row".session_type::text)`,
    status: sql`"row".state`,
  }[filterValues.sort]!;

  // 3. Keep complete lookups separate from bounded cursor pages.
  if (filterValues.limit === undefined) {
    const sortDirection = direction === 'asc' ? sql`ASC` : sql`DESC`;
    return sql<SessionRow[]>`
      SELECT "row".*
      FROM (${filteredRows}) "row"
      ORDER BY ${sortValue} ${sortDirection}, "row".id ${sortDirection}
    `;
  }

  return paginateQuery(filteredRows, {
    sortValue,
    direction,
    cursor: filterValues.cursor,
    limit: filterValues.limit,
  });
}
