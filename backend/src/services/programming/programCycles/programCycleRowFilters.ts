import { sql } from '../../../db/client';
import { programAccessPredicate } from '../../../policies/programAccessPolicy';
import type { AccessTokenPayload } from '../../../types/auth';
import type { ProgramCycleQuery } from '../../../validation/programmingSchemas';

/**
 * Builds filters for table and calendar items.
 * @param actor - Actor whose assignments constrain scoped reads.
 * @param filterValues - Validated program, cycle, and discovery selections.
 * @example buildProgramCycleFilters(actor, filterValues) // matching program-cycle pairs
 */
export function buildProgramCycleFilters(actor: AccessTokenPayload, filterValues: ProgramCycleQuery) {
  // 1. Collect the selected filters.
  const filters = [];
  if (filterValues.programId) {
    filters.push(sql`pc.program_id = ${filterValues.programId}`);
  }
  if (filterValues.cycleId) {
    filters.push(sql`pc.cycle_id = ${filterValues.cycleId}`);
  }
  if (filterValues.scope !== 'all') {
    filters.push(programAccessPredicate(actor, sql`pc.program_id`));
  }

  // 2. Apply the selected filters.
  let appliedFilters = sql`TRUE`;
  for (const filter of filters) {
    appliedFilters = sql`${appliedFilters} AND ${filter}`;
  }
  return appliedFilters;
}
