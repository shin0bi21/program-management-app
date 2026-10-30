import { sql } from '../../../db/client';

export interface CycleRow {
  id: string;
  name: string;
  startsOn: string;
  endsOn: string;
  state: 'active' | 'upcoming' | 'completed';
}

export const cycleState = sql`CASE WHEN CURRENT_DATE < cycle.starts_on THEN 'upcoming' WHEN CURRENT_DATE > cycle.ends_on THEN 'completed' ELSE 'active' END`;
export const cycleRecordColumns = sql`
  cycle.id, cycle.name, cycle.starts_on::text AS starts_on, cycle.ends_on::text AS ends_on,
  ${cycleState} AS state
`;

export async function getCycleRow(database: typeof sql, id: string) {
  const [cycle] = await database<CycleRow[]>`
    SELECT ${cycleRecordColumns} FROM program_cycles cycle WHERE cycle.id = ${id}
  `;
  return cycle;
}
