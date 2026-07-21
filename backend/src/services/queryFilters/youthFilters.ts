import { sql } from '../../db/client';
import type { YouthQuery } from '../../validation/youthSchemas';

function escapeLikePattern(value: string) {
  return value.replace(/[\\%_]/g, character => `\\${character}`);
}

/** Builds the parameterized filters for youth profile list queries. */
export function applyYouthFilters(filters: YouthQuery) {
  const statusFilter = filters.statuses.length
    ? sql`yp.status = ANY(${sql.array(filters.statuses)}::youth_participation_status[])`
    : sql`TRUE`;
  const programFilter = filters.programIds.length
    ? sql`yp.program_id = ANY(${sql.array(filters.programIds)}::uuid[])`
    : sql`TRUE`;
  const searchFilter = filters.search
    ? sql`CONCAT_WS(' ', u.first_name, u.last_name, s.name, p.name) ILIKE ${`%${escapeLikePattern(filters.search)}%`} ESCAPE '\\'`
    : sql`TRUE`;

  return sql`${statusFilter} AND ${programFilter} AND ${searchFilter}`;
}
