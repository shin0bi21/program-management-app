import { sql } from '../../../db/client';
import { taskReadScopePredicate } from '../../../policies/taskPolicy';
import type { AccessTokenPayload } from '../../../types/auth';
import type { TaskListQuery } from '../../../validation/taskSchemas';
import { cursorPage, decodeCursor, DEFAULT_BATCH_SIZE } from '../../shared/cursorPagination';
import {
  attachTaskDetails,
  loadTaskLoggedHours,
  taskRecordColumns,
  taskRecordFrom,
  type TaskRow,
} from './taskRecordQuery';
import { buildTaskFilters } from './taskFilters';

export async function getTaskList(actor: AccessTokenPayload, query: TaskListQuery) {
  const cursor = decodeCursor(query.cursor);
  const direction = query.direction;
  const { status, predicate } = buildTaskFilters(query);
  const sortValue = {
    firstName: sql`LOWER(staff.first_name)`, lastName: sql`LOWER(staff.last_name)`, title: sql`LOWER(task.title)`,
    category: sql`task.category::text`, program: sql`LOWER(COALESCE(program.name, ''))`,
    startDate: sql`task.start_date::text`, dueDate: sql`task.due_date::text`, status,
  }[query.sort]!;
  const rows = await sql<Array<TaskRow & { cursorValue: string }>>`
    SELECT * FROM (SELECT ${taskRecordColumns},
      ${sortValue} AS cursor_value
    ${taskRecordFrom}
    WHERE ${taskReadScopePredicate(actor, sql`task.staff_id`)}
      AND ${predicate}
      AND ${query.start && query.end
        ? sql`task.start_date <= ${query.end}::date AND task.due_date >= ${query.start}::date`
        : sql`TRUE`}
    ) listed
    WHERE ${cursor ? (direction === 'asc'
      ? sql`(listed.cursor_value > ${cursor.value} OR (listed.cursor_value = ${cursor.value} AND listed.id > ${cursor.id}::uuid))`
      : sql`(listed.cursor_value < ${cursor.value} OR (listed.cursor_value = ${cursor.value} AND listed.id < ${cursor.id}::uuid))`) : sql`TRUE`}
    ORDER BY listed.cursor_value ${direction === 'asc' ? sql`ASC` : sql`DESC`}, listed.id ${direction === 'asc' ? sql`ASC` : sql`DESC`}
    LIMIT ${(query.limit ?? DEFAULT_BATCH_SIZE) + 1}
  `;
  const detailed = attachTaskDetails(rows, await loadTaskLoggedHours(rows.map(row => row.id)), actor);
  return cursorPage(detailed, query.limit ?? DEFAULT_BATCH_SIZE);
}
