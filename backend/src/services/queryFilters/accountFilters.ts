import { sql } from '../../db/client';
import type { AccessTokenPayload } from '../../types/auth';
import type { AccountQuery } from '../../validation/accountSchemas';

function escapeLikePattern(value: string) {
  return value.replace(/[\\%_]/g, character => `\\${character}`);
}

/** Builds the complete, parameterized WHERE predicate for the accounts query. */
export function applyAccountFilters(actor: AccessTokenPayload, filters: AccountQuery) {
  const accessScope = actor.role === 'admin'
    ? sql`TRUE`
    : sql`ur.name = 'youth'`;
  const roleFilter = filters.roles.length
    ? sql`ur.name = ANY(${sql.array(filters.roles)}::text[])`
    : sql`TRUE`;
  const statusFilter = filters.statuses.length
    ? sql`uc.status = ANY(${sql.array(filters.statuses)}::account_status[])`
    : sql`TRUE`;
  const searchFilter = filters.search
    ? sql`CONCAT_WS(' ', u.first_name, u.last_name, uc.email) ILIKE ${`%${escapeLikePattern(filters.search)}%`} ESCAPE '\\'`
    : sql`TRUE`;

  return sql`${accessScope} AND ${roleFilter} AND ${statusFilter} AND ${searchFilter}`;
}
