import { sql } from '../../db/client';

export function getCycleReferenceData() {
  return sql<Array<{ id: string; name: string; startsOn: string; endsOn: string; state: 'active' | 'upcoming' | 'completed' }>>`
    SELECT id, name, starts_on::text AS starts_on, ends_on::text AS ends_on,
      CASE WHEN CURRENT_DATE < starts_on THEN 'upcoming' WHEN CURRENT_DATE > ends_on THEN 'completed' ELSE 'active' END AS state
    FROM program_cycles
    ORDER BY starts_on DESC, name, id
  `;
}
