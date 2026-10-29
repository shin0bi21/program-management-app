import { sql } from '../../../db/client';
import { hoursReadScopePredicate } from '../../../policies/hoursPolicy';
import type { AccessTokenPayload } from '../../../types/auth';
import type { HoursTableQuery } from '../../../validation/hoursSchemas';
import { cursorPage, decodeCursor, DEFAULT_BATCH_SIZE } from '../../shared/cursorPagination';
import {
  hoursRecordColumns,
  hoursRecordFrom,
  hoursSearchValue,
  hoursRowToTableRow,
  type HoursRow,
} from './hoursRecordQuery';

export async function getHoursList(actor: AccessTokenPayload, query: HoursTableQuery) {
  const cursor = decodeCursor(query.cursor);
  const direction = query.direction;
  const entryType = sql`CASE WHEN entry.task_id IS NOT NULL THEN 'task' WHEN entry.session_id IS NOT NULL THEN 'session' ELSE 'other' END`;
  const sortValue = {
    firstName: sql`LOWER(staff.first_name)`, lastName: sql`LOWER(staff.last_name)`, date: sql`entry.work_date::text`,
    program: sql`LOWER(COALESCE(program.name, ''))`, cycle: sql`LOWER(cycle.name)`, category: sql`entry.category::text`,
    hours: sql`TO_CHAR(entry.hours, 'FM0000000000.0000')`,
    note: sql`LOWER(entry.note)`, type: entryType,
  }[query.sort]!;
  const rows = await sql<Array<HoursRow & { cursorValue: string }>>`
    SELECT * FROM (SELECT ${hoursRecordColumns},
      ${sortValue} AS cursor_value
    ${hoursRecordFrom}
    WHERE ${hoursReadScopePredicate(actor, sql`entry.staff_id`)}
      ${hoursFilterPredicate(query)}
      AND ${query.start && query.end
        ? sql`entry.work_date BETWEEN ${query.start}::date AND ${query.end}::date`
        : sql`TRUE`}
    ) listed
    WHERE TRUE
      AND ${cursor ? (direction === 'asc'
      ? sql`(listed.cursor_value > ${cursor.value} OR (listed.cursor_value = ${cursor.value} AND listed.id > ${cursor.id}::uuid))`
      : sql`(listed.cursor_value < ${cursor.value} OR (listed.cursor_value = ${cursor.value} AND listed.id < ${cursor.id}::uuid))`) : sql`TRUE`}
    ORDER BY listed.cursor_value ${direction === 'asc' ? sql`ASC` : sql`DESC`}, listed.id ${direction === 'asc' ? sql`ASC` : sql`DESC`}
    LIMIT ${(query.limit ?? DEFAULT_BATCH_SIZE) + 1}
  `;
  const mapped = rows.map(row => ({ ...hoursRowToTableRow(row), cursorValue: row.cursorValue }));
  return cursorPage(mapped, query.limit ?? DEFAULT_BATCH_SIZE);
}

export function hoursFilterPredicate(query: Pick<HoursTableQuery, 'staffIds' | 'categories' | 'programIds' | 'types' | 'cycleIds' | 'search'>) {
  const entryType = sql`CASE WHEN entry.task_id IS NOT NULL THEN 'task' WHEN entry.session_id IS NOT NULL THEN 'session' ELSE 'other' END`;
  const search = query.search ? `%${query.search}%` : null;
  return sql`
    ${query.staffIds.length ? sql`AND entry.staff_id = ANY(${sql.array(query.staffIds)}::uuid[])` : sql``}
    ${query.categories.length ? sql`AND entry.category::text = ANY(${sql.array(query.categories)}::text[])` : sql``}
    ${query.programIds.length ? sql`AND (${query.programIds.includes('general') ? sql`entry.program_id IS NULL OR` : sql``}
      entry.program_id = ANY(${sql.array(query.programIds.filter(id => id !== 'general'))}::uuid[]))` : sql``}
    ${query.types.length ? sql`AND ${entryType} = ANY(${sql.array(query.types)}::text[])` : sql``}
    ${query.cycleIds.length ? sql`AND entry.cycle_id = ANY(${sql.array(query.cycleIds)}::uuid[])` : sql``}
    ${search ? sql`AND ${hoursSearchValue} ILIKE ${search}` : sql``}
  `;
}
