import { sql } from '../../db/client';
import type { ExpressionOfInterestQuery } from '../../validation/expressionOfInterestSchemas';

function escapeLikePattern(value: string) {
  return value.replace(/[\\%_]/g, character => `\\${character}`);
}

export function applyExpressionOfInterestFilters(filters: ExpressionOfInterestQuery) {
  const statusFilter = filters.statuses.length
    ? sql`e.status = ANY(${sql.array(filters.statuses)}::text[])`
    : sql`TRUE`;
  const programFilter = filters.programIds.length
    ? sql`p.id = ANY(${sql.array(filters.programIds)}::uuid[])`
    : sql`TRUE`;
  const searchFilter = filters.search
    ? sql`CONCAT_WS(' ', e.youth_first_name, e.youth_last_name, e.school, p.name) ILIKE ${`%${escapeLikePattern(filters.search)}%`} ESCAPE '\\'`
    : sql`TRUE`;

  return sql`${statusFilter} AND ${programFilter} AND ${searchFilter}`;
}
