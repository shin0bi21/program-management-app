import { sql } from '../../../db/client';
import { programAccessPredicate } from '../../../policies/programAccessPolicy';
import type { AccessTokenPayload } from '../../../types/auth';
import type { ProgramListQuery } from '../../../validation/programSchemas';

/**
 * Builds filters for table and calendar items.
 * @param actor - Actor whose assignments limit assigned-program reads.
 * @param filterValues - Validated discovery scope; route permissions govern all-program reads.
 * @example buildProgramFilters(actor, filterValues) // accessible program scope
 */
export function buildProgramFilters(actor: AccessTokenPayload, filterValues: ProgramListQuery) {
  // 1. Apply the selected program scope.
  if (filterValues.scope === 'assigned') {
    return programAccessPredicate(actor, sql`p.id`);
  }
  return sql`TRUE`;
}
