import { sql } from '../../../db/client';
import { programAccessPredicate } from '../../../policies/programAccessPolicy';
import type { AccessTokenPayload } from '../../../types/auth';
import type { ProgramListQuery } from '../../../validation/programSchemas';
import { cursorPage, decodeCursor, DEFAULT_BATCH_SIZE } from '../../shared/cursorPagination';
import { programRecordColumns, type ProgramRow } from './programRecordQuery';

export async function getProgramList(actor: AccessTokenPayload, query: ProgramListQuery) {
  const cursor = decodeCursor(query.cursor);
  const direction = query.direction;
  const limit = query.limit ?? DEFAULT_BATCH_SIZE;
  const sortValue = sql`LOWER(p.name)`;

  const rows = await sql<Array<ProgramRow & { cursorValue: string }>>`
    SELECT ${programRecordColumns}, ${sortValue} AS cursor_value
    FROM programs p
    WHERE ${query.scope === 'assigned' ? programAccessPredicate(actor, sql`p.id`) : sql`TRUE`}
      AND ${cursor ? (direction === 'asc'
        ? sql`(${sortValue}, p.id) > (${cursor.value}, ${cursor.id}::uuid)`
        : sql`(${sortValue}, p.id) < (${cursor.value}, ${cursor.id}::uuid)`) : sql`TRUE`}
    ORDER BY ${sortValue} ${direction === 'asc' ? sql`ASC` : sql`DESC`},
      p.id ${direction === 'asc' ? sql`ASC` : sql`DESC`}
    LIMIT ${limit + 1}
  `;

  return cursorPage(rows, limit);
}
