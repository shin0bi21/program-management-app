import { sql } from '../../../db/client';
import type { AccessTokenPayload } from '../../../types/auth';
import type { SessionListQuery } from '../../../validation/programmingSchemas';
import { paginateQuery } from '../../shared/cursorPagination';
import { getSessionRows } from './sessionRowQuery';
import { filterSessionRows } from './sessionRowFilters';

/**
 * Lists accessible sessions matching the selected filters, sort, and optional cursor page.
 * @param actor - Actor whose program access scopes the rows; callers enforce route permissions.
 * @param filters - Validated list filters; unpaged calendar ranges default to ascending order.
 * @returns A cursor page when a limit is supplied, otherwise the complete matching rows.
 * @example listSessions(actor, filters) // { rows, nextCursor } when filters.limit is set
 */
export function listSessions(actor: AccessTokenPayload, filters: SessionListQuery) {
  // 1. Filter the canonical, access-scoped session rows.
  const filteredRows = filterSessionRows(getSessionRows(actor), filters);
  const direction = !filters.limit && filters.start ? 'asc' : filters.direction;

  // 2. Choose the session sort and delegate cursor execution and response shaping.
  const sortValue = {
    program: sql`LOWER(page_row.program_name)`,
    cycle: sql`LOWER(page_row.cycle_name)`,
    theme: sql`LOWER(COALESCE(page_row.theme, ''))`,
    date: sql`page_row.starts_at::text`,
    time: sql`page_row.starts_at::text`,
    type: sql`LOWER(page_row.session_type::text)`,
    status: sql`page_row.state`,
  }[filters.sort]!;

  return paginateQuery(filteredRows, {
    sortValue,
    direction,
    cursor: filters.cursor,
    limit: filters.limit,
  });
}
