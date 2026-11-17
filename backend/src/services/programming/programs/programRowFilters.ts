import { sql } from '../../../db/client';
import { programAccessPredicate } from '../../../policies/programAccessPolicy';
import type { AccessTokenPayload } from '../../../types/auth';
import type { ProgramListQuery } from '../../../validation/programSchemas';

/**
 * Builds filters for table and calendar items.
 * @param user - User whose assignments limit assigned-program reads.
 * @param filterValues - Validated discovery scope; route permissions govern all-program reads.
 * @example buildProgramFilters(user, filterValues) // accessible program scope
 */
export function buildProgramFilters(user: AccessTokenPayload, filterValues: ProgramListQuery) {
  // 1. Apply the selected program scope.
  if (filterValues.scope === 'assigned') {
    return programAccessPredicate(user, sql`p.id`);
  }
  return sql`TRUE`;
}
