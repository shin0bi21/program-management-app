import { sql } from '../../../db/client';
import { hoursReadScopePredicate } from '../../../policies/hoursPolicy';
import type { AccessTokenPayload } from '../../../types/auth';
import type { HoursTableQuery } from '../../../validation/hoursSchemas';
import { cursorPage, decodeCursor } from '../../shared/cursorPagination';
import {
  hoursRecordColumns,
  hoursRecordFrom,
  type HoursRow,
} from './hoursRecordQuery';
import { getHoursCategoryLabel } from './hoursReferenceData';

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
  const search = query.search ? `%${query.search}%` : null;
  const rows = await sql<Array<HoursRow & { staffFirstName: string; staffLastName: string; staffName: string; cursorValue: string }>>`
    SELECT * FROM (SELECT ${hoursRecordColumns},
      staff.first_name AS staff_first_name, staff.last_name AS staff_last_name,
      CONCAT(staff.first_name, ' ', staff.last_name) AS staff_name,
      ${sortValue} AS cursor_value,
      CONCAT_WS(' ', staff.first_name, staff.last_name, program.name, cycle.name, entry.category::text,
        task.title, session.theme, entry.note, entry.work_date::text) AS search_value
    ${hoursRecordFrom}
    WHERE ${hoursReadScopePredicate(actor, sql`entry.staff_id`)}
      AND ${query.staffIds.length ? sql`entry.staff_id = ANY(${sql.array(query.staffIds)}::uuid[])` : sql`TRUE`}
      AND ${query.categories.length ? sql`entry.category::text = ANY(${sql.array(query.categories)}::text[])` : sql`TRUE`}
      AND ${query.programIds.length ? sql`(${query.programIds.includes('general') ? sql`entry.program_id IS NULL OR` : sql``}
        entry.program_id = ANY(${sql.array(query.programIds.filter(id => id !== 'general'))}::uuid[]))` : sql`TRUE`}
      AND ${query.types.length ? sql`${entryType} = ANY(${sql.array(query.types)}::text[])` : sql`TRUE`}
      AND ${query.cycleId ? sql`entry.cycle_id = ${query.cycleId}` : sql`TRUE`}
    ) listed
    WHERE ${search ? sql`listed.search_value ILIKE ${search}` : sql`TRUE`}
      AND ${cursor ? (direction === 'asc'
      ? sql`(listed.cursor_value > ${cursor.value} OR (listed.cursor_value = ${cursor.value} AND listed.id > ${cursor.id}::uuid))`
      : sql`(listed.cursor_value < ${cursor.value} OR (listed.cursor_value = ${cursor.value} AND listed.id < ${cursor.id}::uuid))`) : sql`TRUE`}
    ORDER BY listed.cursor_value ${direction === 'asc' ? sql`ASC` : sql`DESC`}, listed.id ${direction === 'asc' ? sql`ASC` : sql`DESC`}
    LIMIT ${(query.limit ?? 25) + 1}
  `;
  const mapped = [...new Map(rows.map(row => [row.id, {
    id: row.id, resourceId: row.staffId, date: row.workDate,
    staffFirstName: row.staffFirstName, staffLastName: row.staffLastName, staffName: row.staffName,
    item: {
      id: row.id, programId: row.programId, programName: row.programName, cycleId: row.cycleId,
      cycleName: row.cycleName, cycleStartsOn: row.cycleStartsOn, cycleEndsOn: row.cycleEndsOn,
      category: row.category, categoryLabel: getHoursCategoryLabel(row.category), taskId: row.taskId,
      taskTitle: row.taskTitle, sessionId: row.sessionId, sessionLabel: row.sessionLabel,
      hours: Number(row.hours), note: row.note,
    },
    cursorValue: row.cursorValue,
  }])).values()];
  return cursorPage(mapped, query.limit ?? 25);
}
