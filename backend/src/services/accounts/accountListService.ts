import { sql } from '../../db/client';
import { accountAccessPredicate } from '../../policies/accountPolicy';
import type { AccessTokenPayload } from '../../types/auth';
import type { AccountQuery } from '../../validation/accountSchemas';
import { cursorPage, decodeCursor } from '../shared/cursorPagination';
import { accountRecordColumns, accountRecordFrom, type AccountRow } from './accountRecordQuery';

export async function listAccounts(actor: AccessTokenPayload, filters: AccountQuery) {
  const where = applyAccountFilters(actor, filters);
  const cursor = decodeCursor(filters.cursor);
  const sortValue = {
    name: sql`LOWER(u.first_name || ' ' || u.last_name)`, email: sql`LOWER(uc.email)`,
    role: sql`ur.name::text`, status: sql`uc.status::text`, createdAt: sql`u.created_at::text`,
  }[filters.sort]!;
  const rows = await sql<Array<AccountRow & { cursorValue: string }>>`
    SELECT
      ${accountRecordColumns},
      ${sortValue} AS cursor_value
    ${accountRecordFrom}
    WHERE ${where}
      AND ${cursor ? (filters.direction === 'asc'
        ? sql`(${sortValue}, u.id) > (${cursor.value}, ${cursor.id}::uuid)`
        : sql`(${sortValue}, u.id) < (${cursor.value}, ${cursor.id}::uuid)`) : sql`TRUE`}
    ORDER BY ${sortValue} ${filters.direction === 'asc' ? sql`ASC` : sql`DESC`}, u.id ${filters.direction === 'asc' ? sql`ASC` : sql`DESC`}
    ${filters.limit ? sql`LIMIT ${filters.limit + 1}` : sql``}
  `;
  return filters.limit ? cursorPage(rows, filters.limit) : rows.map(({ cursorValue: _cursorValue, ...row }) => row);
}

function applyAccountFilters(actor: AccessTokenPayload, filters: AccountQuery) {
  const accessScope = accountAccessPredicate(actor, sql`ur.name`);
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

function escapeLikePattern(value: string) {
  return value.replace(/[\\%_]/g, character => `\\${character}`);
}
