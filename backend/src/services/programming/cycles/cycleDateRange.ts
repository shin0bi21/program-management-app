import { sql } from '../../../db/client';

interface CycleDateRange {
  start: string;
  end: string;
}

/**
 * Resolves the inclusive span of selected cycles; missing cycles return null.
 * @param query - Shared client or the caller's existing transaction.
 * @param cycleIds - Selected IDs; an empty selection spans all cycles.
 * @example resolveCycleDateRange(sql, []) // span of all cycles, or null if none exist
 */
export async function resolveCycleDateRange(query: typeof sql, cycleIds: readonly string[]): Promise<CycleDateRange | null> {
  const [range] = await query<Array<{ start: string | null; end: string | null }>>`
    SELECT
      MIN(starts_on) AS start,
      MAX(ends_on) AS end
    FROM program_cycles
    WHERE ${cycleIds.length ? query`id = ANY(${query.array([...cycleIds])}::uuid[])` : query`TRUE`}
  `;

  return range.start && range.end ? { start: range.start, end: range.end } : null;
}
