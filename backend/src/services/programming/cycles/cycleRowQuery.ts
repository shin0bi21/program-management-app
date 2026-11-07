import { sql } from '../../../db/client';

export interface CycleRow {
  id: string;
  name: string;
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
  cycle.id, cycle.name, cycle.starts_on::text AS starts_on, cycle.ends_on::text AS ends_on,
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

/**
 * Loads one cycle with its current state.
 * @param id - Cycle to load.
 * @param query - Defaults to the shared client; pass trx for a transaction.
 * @example getCycleRow(cycleId, trx) // saved cycle, or undefined
 */
export async function getCycleRow(id: string, query = sql) {
  // 1. Load the cycle.
  const [cycle] = await getCycleRows(query`cycle.id = ${id}`, query);
  return cycle;
}
