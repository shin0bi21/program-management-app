import { sql } from '../../../db/client';
import type { LeadQuery } from '../../../validation/leadSchemas';

type LeadFilters = Pick<LeadQuery, 'statuses' | 'programIds' | 'origins' | 'submitterRoles' | 'search'>;

/**
 * Builds filters for table and calendar items.
 * @param filterValues - Validated intake selections; empty selections add no restriction.
 * @returns Combined restrictions against the canonical intake and recommended program.
 * @example buildLeadFilters(filterValues) // matching lead filters
 */
export function buildLeadFilters(filterValues: LeadFilters) {
  // 1. Collect the selected filters.
  const filters = [];
  if (filterValues.statuses.length) {
    filters.push(sql`lead.status = ANY(${sql.array(filterValues.statuses)}::lead_status[])`);
  }
  if (filterValues.programIds.length) {
    filters.push(sql`recommended_program.id = ANY(${sql.array(filterValues.programIds)}::uuid[])`);
  }
  if (filterValues.origins.length) {
    filters.push(sql`lead.origin = ANY(${sql.array(filterValues.origins)}::lead_origin[])`);
  }
  if (filterValues.submitterRoles.length) {
    filters.push(sql`lead.submitted_by_role = ANY(${sql.array(filterValues.submitterRoles)}::lead_submitter_role[])`);
  }
  if (filterValues.search) {
    const search = `%${escapeLikePattern(filterValues.search)}%`;
    filters.push(sql`CONCAT_WS(' ', lead.youth_first_name, lead.youth_last_name, lead.school) ILIKE ${search} ESCAPE '\\'`);
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
