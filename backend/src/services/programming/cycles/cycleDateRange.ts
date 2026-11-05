import { sql } from '../../../db/client';

interface CycleDateRange {
  start: string;
  end: string;
}

// Empty selection spans all cycles; an unavailable selection never becomes an unbounded range.
export async function resolveCycleDateRange(database: typeof sql, cycleIds: readonly string[]): Promise<CycleDateRange | null> {
  const [range] = await database<Array<{ start: string | null; end: string | null }>>`
    SELECT MIN(starts_on)::text AS start, MAX(ends_on)::text AS end
    FROM program_cycles
    WHERE ${cycleIds.length ? database`id = ANY(${database.array([...cycleIds])}::uuid[])` : database`TRUE`}
  `;

  return range.start && range.end ? { start: range.start, end: range.end } : null;
}
