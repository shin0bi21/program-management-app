import { sql } from '../../db/client';
import { accountAccessPredicate } from '../../policies/accountPolicy';
import type { AccessTokenPayload } from '../../types/auth';
import type { AccountQuery } from '../../validation/accountSchemas';

/**
 * Builds filters for table and calendar items.
 * @param user - User whose role limits visible accounts.
 * @param filterValues - Validated role, status, and search selections.
 * @example buildAccountFilters(user, filterValues) // scoped account filters
 */
export function buildAccountFilters(user: AccessTokenPayload, filterValues: AccountQuery) {
  // 1. Collect the selected filters.
  const filters = [];
  if (filterValues.roles.length) {
    filters.push(sql`ur.name = ANY(${sql.array(filterValues.roles)}::text[])`);
  }
  if (filterValues.statuses.length) {
    filters.push(sql`uc.status = ANY(${sql.array(filterValues.statuses)}::account_status[])`);
  }
  if (filterValues.search) {
    const search = `%${escapeLikePattern(filterValues.search)}%`;
    filters.push(sql`CONCAT_WS(' ', u.first_name, u.last_name, uc.email) ILIKE ${search} ESCAPE '\\'`);
  }

  // 2. Apply the filters within account access.
  let appliedFilters = accountAccessPredicate(user, sql`ur.name`);
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
