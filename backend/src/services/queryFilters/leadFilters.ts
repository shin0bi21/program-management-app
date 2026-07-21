import { sql } from '../../db/client';
import type { LeadQuery } from '../../validation/leadSchemas';

function escapeLikePattern(value: string) {
  return value.replace(/[\\%_]/g, character => `\\${character}`);
}

/** Builds the complete, parameterized WHERE predicate for the leads query. */
export function applyLeadFilters(filters: LeadQuery) {
  const statusFilter = filters.statuses.length
    ? sql`status = ANY(${sql.array(filters.statuses)}::lead_status[])`
    : sql`TRUE`;
  const searchFilter = filters.search
    ? sql`CONCAT_WS(' ', youth_first_name, youth_last_name, school) ILIKE ${`%${escapeLikePattern(filters.search)}%`} ESCAPE '\\'`
    : sql`TRUE`;

  return sql`${statusFilter} AND ${searchFilter}`;
}
