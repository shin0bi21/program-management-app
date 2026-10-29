import { sql } from '../../../db/client';
import type { CycleListQuery } from '../../../validation/cohortSchemas';
import { cursorPage, decodeCursor, DEFAULT_BATCH_SIZE } from '../../shared/cursorPagination';
import { cycleRecordColumns, type CycleRow } from './cycleRecordQuery';

export async function listCycles(query: CycleListQuery) {
  const cursor = decodeCursor(query.cursor);
  const limit = query.limit ?? DEFAULT_BATCH_SIZE;
  const sortValue = query.sort === 'name' ? sql`LOWER(cycle.name)` : sql`cycle.starts_on::text`;
  const ascending = query.direction === 'asc';

  const rows = await sql<Array<CycleRow & { cursorValue: string }>>`
    SELECT ${cycleRecordColumns}, ${sortValue} AS cursor_value
    FROM program_cycles cycle
    WHERE ${cursor ? (ascending
      ? sql`(${sortValue}, cycle.id) > (${cursor.value}, ${cursor.id}::uuid)`
      : sql`(${sortValue}, cycle.id) < (${cursor.value}, ${cursor.id}::uuid)`) : sql`TRUE`}
    ORDER BY ${sortValue} ${ascending ? sql`ASC` : sql`DESC`}, cycle.id ${ascending ? sql`ASC` : sql`DESC`}
    LIMIT ${limit + 1}
  `;
  return cursorPage(rows, limit);
}
