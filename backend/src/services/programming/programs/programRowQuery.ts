import { sql } from '../../../db/client';
import type { Programs } from '../../../types/database';
import type { DbRow } from '../../../types/db';

export type ProgramRow = DbRow<Pick<Programs,
  'id' | 'title' | 'description' | 'enrollment_required' | 'min_age' | 'max_age'
  | 'default_day_of_week' | 'default_start_time' | 'default_end_time' | 'timezone'
>>;

export const programRowColumns = sql`
  p.id, p.title, p.description, p.enrollment_required, p.min_age, p.max_age, p.default_day_of_week,
  to_char(p.default_start_time, 'HH24:MI') AS default_start_time,
  to_char(p.default_end_time, 'HH24:MI') AS default_end_time, p.timezone
`;

/**
 * Builds rows for table and calendar items.
 * @param appliedFilters - SQL filters supplied by the service.
 * @param query - Database client; pass trx inside a transaction.
 * @example getProgramRows(appliedFilters, trx)
 */
export function getProgramRows(appliedFilters = sql`TRUE`, query = sql) {
  return query<ProgramRow[]>`
    SELECT ${programRowColumns}
    FROM programs p
    WHERE ${appliedFilters}
  `;
}
