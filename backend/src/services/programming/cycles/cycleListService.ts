import { sql } from '../../../db/client';
import type { CycleListQuery } from '../../../validation/programmingSchemas';
import { paginateQuery, BATCH_SIZE } from '../../shared/cursorPagination';
import { getCycleRows } from './cycleRowQuery';

/**
 * Lists complete cycle rows ordered by name or start date, with UUID tie-breaking.
 * @param filters - Validated sorting and cursor options; an omitted limit uses 50 rows.
 * @returns A bounded cursor page; callers enforce the cycle-read capability.
 * @example listCycles(filters) // { rows, nextCursor }
 */
export function listCycles(filters: CycleListQuery) {
  // 1. Build the canonical cycle collection before pagination.
  const rowsQuery = getCycleRows();

  // 2. Apply the selected sort and bounded page contract.
  const sortValue = filters.sort === 'name'
    ? sql`LOWER(page_row.name)`
    : sql`page_row.starts_on`;

  return paginateQuery(rowsQuery, {
    sortValue,
    direction: filters.direction,
    cursor: filters.cursor,
    limit: filters.limit ?? BATCH_SIZE,
  });
}
