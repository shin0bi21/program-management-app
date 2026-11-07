import { BadRequestError } from '../../errors';
import { sql } from '../../db/client';
import type { PendingQuery, Row } from 'postgres';

export const DEFAULT_BATCH_SIZE = 50;
export const MAX_BATCH_SIZE = 50;

export interface ListCursor {
  value: string;
  id: string;
}

interface QueryPagination {
  /** Trusted, non-null SQL text expression against the query's `page_row` alias. */
  sortValue: PendingQuery<Row[]>;
  direction: 'asc' | 'desc';
  cursor?: string;
  /** Validated positive page size; omit for an unpaged array response. */
  limit?: number;
}

/**
 * Executes an already scoped and filtered query with consistent cursor pagination.
 * Rows must have UUID IDs; sort expressions reference the `page_row` alias. Nullable
 * sort values must be normalized by the caller, and `cursor_value` is reserved.
 * @param rowsQuery - Unexecuted canonical rows with domain access and filters already applied.
 * @param pagination - Trusted sort expression, direction, optional cursor, and validated limit.
 * @param query - Defaults to the shared client; pass trx to join an existing transaction.
 * @returns A cursor page when limited, otherwise an ordered array, without internal cursor values.
 * @example paginateQuery(rows, { sortValue: sql`LOWER(page_row.name)`, direction: 'asc', limit: 50 })
 */
export async function paginateQuery<T extends { id: string }>(
  rowsQuery: PendingQuery<T[]>,
  pagination: QueryPagination,
  query = sql,
) {
  // 1. Match the cursor boundary to the selected sort and UUID tie-breaker.
  const cursor = decodeCursor(pagination.cursor);
  const { sortValue, direction, limit } = pagination;
  const sortDirection = direction === 'asc' ? query`ASC` : query`DESC`;
  let cursorFilter = query`TRUE`;
  if (cursor) {
    cursorFilter = direction === 'asc'
      ? query`(${sortValue}, page_row.id) > (${cursor.value}, ${cursor.id}::uuid)`
      : query`(${sortValue}, page_row.id) < (${cursor.value}, ${cursor.id}::uuid)`;
  }

  // 2. Fetch one extra row to determine whether another page exists.
  const rows = await query<Array<T & { cursorValue: string }>>`
    SELECT page_row.*, ${sortValue} AS cursor_value
    FROM (${rowsQuery}) page_row
    WHERE ${cursorFilter}
    ORDER BY ${sortValue} ${sortDirection}, page_row.id ${sortDirection}
    ${limit ? query`LIMIT ${limit + 1}` : query``}
  `;

  // 3. Return the collection contract requested by the caller.
  if (limit) return cursorPage(rows, limit);
  return rows.map(({ cursorValue: _cursorValue, ...row }) => row);
}

/**
 * Encodes a sort value and UUID tie-breaker for the next page.
 * @param cursor - Boundary of the last visible row.
 * @example encodeCursor({ value: 'alpha', id }) // base64url JSON cursor
 */
export function encodeCursor(cursor: ListCursor) {
  return Buffer.from(JSON.stringify(cursor), 'utf8').toString('base64url');
}

/**
 * Decodes a cursor, rejecting invalid JSON, sort values, or UUIDs with a 400 error.
 * @param cursor - Optional base64url cursor from a previous page.
 * @example decodeCursor(undefined) // null
 */
export function decodeCursor(cursor?: string): ListCursor | null {
  if (!cursor) return null;
  try {
    const parsed = JSON.parse(Buffer.from(cursor, 'base64url').toString('utf8')) as unknown;
    if (!parsed || typeof parsed !== 'object') throw new Error('Invalid cursor');
    const { value, id } = parsed as Partial<ListCursor>;
    if (typeof value !== 'string' || typeof id !== 'string'
      || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id)) {
      throw new Error('Invalid cursor');
    }
    return { value, id };
  } catch {
    throw new BadRequestError('Invalid pagination cursor');
  }
}

/**
 * Removes internal sort values and derives the next cursor from an extra-row query.
 * @param rows - Ordered rows including up to one extra row beyond the page size.
 * @param limit - Validated positive page size.
 * @example cursorPage([], 50) // { rows: [], nextCursor: null }
 */
export function cursorPage<T extends { id: string; cursorValue: string }>(rows: T[], limit: number) {
  const hasMore = rows.length > limit;
  const visible = hasMore ? rows.slice(0, limit) : rows;
  const last = visible.at(-1);
  return {
    rows: visible.map(({ cursorValue: _cursorValue, ...row }) => row),
    nextCursor: hasMore && last ? encodeCursor({ value: last.cursorValue, id: last.id }) : null,
  };
}
