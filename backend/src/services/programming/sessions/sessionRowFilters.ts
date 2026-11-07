import type { PendingQuery } from 'postgres';
import { sql } from '../../../db/client';
import type { SessionListQuery } from '../../../validation/programmingSchemas';
import type { ProgramSessionRow } from './sessionRowQuery';

interface SessionRowFilters extends Partial<Pick<SessionListQuery,
  'start' | 'end' | 'programIds' | 'cycleIds' | 'sessionTypes' | 'statuses' | 'search'
>> {
  ids?: readonly string[];
}

/**
 * Applies session IDs, dates, programs, cycles, types, statuses, and search to canonical rows.
 * Omitted filters add no restriction; an explicit empty ID list matches no rows.
 * @param rowsQuery - Unexecuted, access-scoped session rows.
 * @param filters - Validated session filters; date bounds must be supplied together.
 * @param query - Defaults to the shared client; pass trx to join an existing transaction.
 * @returns A composable filtered query without ordering or pagination.
 * @example filterSessionRows(getSessionRows(actor), { ids: [sessionId] }) // only that accessible session
 */
export function filterSessionRows(
  rowsQuery: PendingQuery<ProgramSessionRow[]>,
  filters: SessionRowFilters,
  query = sql,
) {
  const search = filters.search ? `%${filters.search}%` : null;
  const completedOnly = filters.statuses?.length === 1 && filters.statuses[0] === 'completed';

  // 1. Apply caller filters without changing the row projection or access scope.
  const dateFilter = filters.start && filters.end
    ? query`session.starts_at < ${filters.end}::timestamptz AND session.ends_at > ${filters.start}::timestamptz`
    : query`TRUE`;
  let statusFilter = query`TRUE`;
  if (filters.statuses?.length === 1) {
    statusFilter = completedOnly ? query`session.ends_at < NOW()` : query`session.ends_at >= NOW()`;
  }

  return query<ProgramSessionRow[]>`
    SELECT session.*
    FROM (${rowsQuery}) session
    WHERE ${filters.ids ? query`session.id = ANY(${query.array([...filters.ids])}::uuid[])` : query`TRUE`}
      AND ${dateFilter}
      AND ${filters.programIds?.length ? query`session.program_id = ANY(${query.array(filters.programIds)}::uuid[])` : query`TRUE`}
      AND ${filters.cycleIds?.length ? query`session.cycle_id = ANY(${query.array(filters.cycleIds)}::uuid[])` : query`TRUE`}
      AND ${filters.sessionTypes?.length ? query`session.session_type = ANY(${query.array(filters.sessionTypes)}::session_type[])` : query`TRUE`}
      AND ${statusFilter}
      AND ${search ? query`(
        COALESCE(session.theme, '') ILIKE ${search}
        OR COALESCE(session.description, '') ILIKE ${search}
        OR session.cycle_name ILIKE ${search}
        OR session.program_name ILIKE ${search}
        OR session.session_type::text ILIKE ${search}
      )` : query`TRUE`}
  `;
}
