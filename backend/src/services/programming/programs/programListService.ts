import { sql } from '../../../db/client';
import type { AccessTokenPayload } from '../../../types/auth';
import type { ProgramListQuery } from '../../../validation/programSchemas';
import { paginateQuery } from '../../shared/cursorPagination';
import { getProgramRows } from './programRowQuery';
import { buildProgramFilters } from './programRowFilters';

/**
 * Lists programs matching the selected scope.
 * @param actor - User requesting the programs.
 * @param filterValues - Validated scope and pagination options.
 * @returns A page of matching programs.
 * @example getProgramList(actor, filterValues) // { rows, nextCursor }
 */
export function getProgramList(actor: AccessTokenPayload, filterValues: ProgramListQuery) {
  // 1. Find matching programs.
  const appliedFilters = buildProgramFilters(actor, filterValues);
  const rowsQuery = getProgramRows(appliedFilters);

  // 2. Return the requested page.
  return paginateQuery(rowsQuery, {
    sortValue: sql`LOWER("row".title)`,
    direction: filterValues.direction,
    cursor: filterValues.cursor,
  });
}
