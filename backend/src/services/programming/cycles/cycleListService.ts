import { sql } from '../../../db/client';
import type { CycleListQuery } from '../../../validation/programmingSchemas';
import { paginateQuery } from '../../shared/cursorPagination';
import { getCycleRows } from './cycleRowQuery';

/**
 * Lists complete cycle rows ordered by name or start date, with UUID tie-breaking.
 * @param filterValues - Validated sorting and cursor options; pages always contain up to 50 rows.
 * @returns A bounded cursor page; callers enforce the cycle-read capability.
 * @example listCycles(filterValues) // { rows, nextCursor }
 */
export function listCycles(filterValues: CycleListQuery) {
  // 1. Build the canonical cycle collection before pagination.
  const rowsQuery = getCycleRows();

  // 2. Apply the selected sort and bounded page contract.
  const sortValue = filterValues.sort === 'name'
    ? sql`LOWER("row".name)`
    : sql`"row".starts_on`;

  return paginateQuery(rowsQuery, {
    sortValue,
    direction: filterValues.direction,
    cursor: filterValues.cursor,
  });
}
