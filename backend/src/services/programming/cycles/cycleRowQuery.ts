import { sql } from '../../../db/client';

export interface CycleRow {
  id: string;
  title: string;
  startsOn: string;
  endsOn: string;
  state: 'active' | 'upcoming' | 'completed';
}

export const cycleState = sql`
  CASE
    WHEN CURRENT_DATE < cycle.starts_on THEN 'upcoming'
    WHEN CURRENT_DATE > cycle.ends_on THEN 'completed'
    ELSE 'active'
  END
`;
export const cycleRowColumns = sql`
  cycle.id,
  cycle.title,
  cycle.starts_on,
  cycle.ends_on,

  ${cycleState} AS state
`;

/**
 * Builds rows for table and calendar items.
 * @param appliedFilters - SQL filters supplied by the service.
 * @param query - Database client; pass trx inside a transaction.
 * @example getCycleRows(appliedFilters, trx)
 */
export function getCycleRows(appliedFilters = sql`TRUE`, query = sql) {
  return query<CycleRow[]>`
    SELECT ${cycleRowColumns}
    FROM program_cycles cycle
    WHERE ${appliedFilters}
  `;
}
