import { sql } from '../../../db/client';
import type { LeadQuery } from '../../../validation/leadSchemas';
import { recommendedProgramId } from './leadRowQuery';

/**
 * Builds filters for table and calendar items.
 * @param filterValues - Validated intake selections; empty selections add no restriction.
 * @example buildLeadFilters(filterValues) // matching lead filters
 */
export function buildLeadFilters(filterValues: LeadQuery) {
  // 1. Collect the selected filters.
  const filters = [];
  if (filterValues.statuses.length) {
    filters.push(sql`status = ANY(${sql.array(filterValues.statuses)}::lead_status[])`);
  }
  if (filterValues.programIds.length) {
    filters.push(sql`${recommendedProgramId} = ANY(${sql.array(filterValues.programIds)}::uuid[])`);
  }
  if (filterValues.origins.length) {
    filters.push(sql`origin = ANY(${sql.array(filterValues.origins)}::lead_origin[])`);
  }
  if (filterValues.submitterRoles.length) {
    filters.push(sql`submitted_by_role = ANY(${sql.array(filterValues.submitterRoles)}::lead_submitter_role[])`);
  }
  if (filterValues.search) {
    const search = `%${escapeLikePattern(filterValues.search)}%`;
    filters.push(sql`CONCAT_WS(' ', youth_first_name, youth_last_name, school) ILIKE ${search} ESCAPE '\\'`);
  }

  // 2. Apply the selected filters.
  let appliedFilters = sql`TRUE`;
  for (const filter of filters) {
    appliedFilters = sql`${appliedFilters} AND ${filter}`;
  }
  return appliedFilters;
}

/**
 * Escapes special LIKE characters for literal search.
 * @param value - Search text before surrounding wildcards are added.
 * @example escapeLikePattern('name') // 'name'
 */
function escapeLikePattern(value: string) {
  return value.replace(/[\\%_]/g, character => `\\${character}`);
}
