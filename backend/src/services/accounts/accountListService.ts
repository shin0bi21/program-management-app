import { sql } from '../../db/client';
import type { AccessTokenPayload } from '../../types/auth';
import type { AccountQuery } from '../../validation/accountSchemas';
import { paginateQuery } from '../shared/cursorPagination';
import { buildAccountFilters } from './accountRowFilters';
import { getAccountRows, type AccountRow } from './accountRowQuery';

/**
 * Lists matching accounts.
 * @param actor - Actor whose role determines account visibility; callers enforce route permissions.
 * @param filterValues - Validated role/status/search, sorting, and optional cursor-page inputs.
 * @returns A cursor page when limited, otherwise all matching rows in the requested order.
 * @example listAccounts(actor, filterValues) // { rows, nextCursor } when filterValues.limit is set
 */
export function listAccounts(actor: AccessTokenPayload, filterValues: AccountQuery) {
  // 1. Load the matching accounts.
  const appliedFilters = buildAccountFilters(actor, filterValues);
  const rowsQuery = getAccountRows(appliedFilters);

  // 2. Choose the account order.
  const sortValue = {
    name: sql`LOWER("row".first_name || ' ' || "row".last_name)`,
    email: sql`LOWER("row".email)`,
    role: sql`"row".role::text`,
    status: sql`"row".status::text`,
    createdAt: sql`"row".created_at::text`,
  }[filterValues.sort]!;

  // 3. Return the requested list or page.
  if (filterValues.limit === undefined) {
    const sortDirection = filterValues.direction === 'asc' ? sql`ASC` : sql`DESC`;
    return sql<AccountRow[]>`
      SELECT "row".*
      FROM (${rowsQuery}) "row"
      ORDER BY ${sortValue} ${sortDirection}, "row".id ${sortDirection}
    `;
  }

  return paginateQuery(rowsQuery, {
    sortValue,
    direction: filterValues.direction,
    cursor: filterValues.cursor,
    limit: filterValues.limit,
  });
}
