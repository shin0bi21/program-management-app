import { sql } from '../../../db/client';
import { programAccessPredicate } from '../../../policies/programAccessPolicy';
import type { AccessTokenPayload } from '../../../types/auth';
import type { CohortQuery } from '../../../validation/cohortSchemas';
import { cursorPage, decodeCursor } from '../../shared/cursorPagination';
import { cohortRecordColumns, cohortRecordFrom, cohortState, type CohortRow } from './cohortRecordQuery';

export function listCohorts(actor: AccessTokenPayload, query: CohortQuery) {
  const cursor = decodeCursor(query.cursor);
  const state = cohortState;
  const sortValue = {
    program: sql`LOWER(p.name)`, cohort: sql`LOWER(cycle.name)`, start: sql`cycle.starts_on::text`,
    end: sql`cycle.ends_on::text`, status: state,
  }[query.sort]!;
  const search = query.search ? `%${query.search}%` : null;
  return sql<Array<CohortRow & { cursorValue: string }>>`
    SELECT ${cohortRecordColumns}, ${sortValue} AS cursor_value
    ${cohortRecordFrom}
    WHERE ${query.programId ? sql`pc.program_id = ${query.programId}` : sql`TRUE`}
      AND ${query.scope === 'all' ? sql`TRUE` : programAccessPredicate(actor, sql`pc.program_id`)}
      AND ${query.cycleId ? sql`pc.cycle_id = ${query.cycleId}` : sql`TRUE`}
      AND ${search ? sql`(cycle.name ILIKE ${search} OR p.name ILIKE ${search})` : sql`TRUE`}
      AND ${query.status ? sql`${state} = ${query.status}` : sql`TRUE`}
      AND ${cursor ? (query.direction === 'asc'
        ? sql`(${sortValue}, pc.id) > (${cursor.value}, ${cursor.id}::uuid)`
        : sql`(${sortValue}, pc.id) < (${cursor.value}, ${cursor.id}::uuid)`) : sql`TRUE`}
    ORDER BY ${sortValue} ${query.direction === 'asc' ? sql`ASC` : sql`DESC`}, pc.id ${query.direction === 'asc' ? sql`ASC` : sql`DESC`}
    ${query.limit ? sql`LIMIT ${query.limit + 1}` : sql``}
  `.then(rows => query.limit ? cursorPage(rows, query.limit) : rows.map(({ cursorValue: _cursorValue, ...row }) => row));
}
