import type { PendingQuery } from 'postgres';
import { sql } from '../../../db/client';
import type { SessionListQuery } from '../../../validation/programmingSchemas';
import type { SessionRow } from './sessionRowQuery';

interface SessionRowFilters extends Partial<Pick<SessionListQuery,
  'start' | 'end' | 'programIds' | 'cycleIds' | 'sessionTypes' | 'statuses' | 'search'
>> {
  ids?: readonly string[];
}

/**
 * Builds filters for table and calendar items.
 * @param rowsQuery - Unexecuted, access-scoped session rows.
 * @param filterValues - Validated session filters; date bounds must be supplied together.
 * @param query - Defaults to the shared client; pass trx to join an existing transaction.
 * @returns A composable filtered query without ordering or pagination.
 * @example buildSessionFilters(getSessionRows(actor), { ids: [sessionId] }) // only that accessible session
 */
export function buildSessionFilters(
  rowsQuery: PendingQuery<SessionRow[]>,
  filterValues: SessionRowFilters,
  query = sql,
) {
  // 1. Collect restrictions without changing the source rows or access scope.
  const filters = [];
  if (filterValues.ids !== undefined) {
    filters.push(query`session.id = ANY(${query.array([...filterValues.ids])}::uuid[])`);
  }
  if (filterValues.start && filterValues.end) {
    filters.push(query`
      session.starts_at < ${filterValues.end}::timestamptz
      AND session.ends_at > ${filterValues.start}::timestamptz
    `);
  }
  if (filterValues.programIds?.length) {
    filters.push(query`session.program_id = ANY(${query.array(filterValues.programIds)}::uuid[])`);
  }
  if (filterValues.cycleIds?.length) {
    filters.push(query`session.cycle_id = ANY(${query.array(filterValues.cycleIds)}::uuid[])`);
  }
  if (filterValues.sessionTypes?.length) {
    filters.push(query`session.session_type = ANY(${query.array(filterValues.sessionTypes)}::session_type[])`);
  }
  if (filterValues.statuses?.length === 1) {
    if (filterValues.statuses[0] === 'completed') {
      filters.push(query`session.ends_at < NOW()`);
    } else {
      filters.push(query`session.ends_at >= NOW()`);
    }
  }
  if (filterValues.search) {
    const search = `%${filterValues.search}%`;
    filters.push(query`(
      COALESCE(session.theme, '') ILIKE ${search}
      OR COALESCE(session.description, '') ILIKE ${search}
      OR session.cycle_name ILIKE ${search}
      OR session.program_name ILIKE ${search}
      OR session.session_type::text ILIKE ${search}
    )`);
  }

  // 2. Combine selected filters and return the composable query.
  let appliedFilters = query`TRUE`;
  for (const filter of filters) {
    appliedFilters = query`
      ${appliedFilters}
      AND ${filter}
    `;
  }

  return query<SessionRow[]>`
    SELECT session.*
    FROM (${rowsQuery}) session
    WHERE ${appliedFilters}
  `;
}
