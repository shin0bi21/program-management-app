import { sql } from '../../../db/client';
import { taskReadScopePredicate } from '../../../policies/taskPolicy';
import type { AccessTokenPayload } from '../../../types/auth';
import type { TaskListQuery } from '../../../validation/taskSchemas';
import { cursorPage, decodeCursor } from '../../shared/cursorPagination';
import {
  attachTaskDetails,
  loadTaskLoggedHours,
  taskRecordColumns,
  taskRecordFrom,
  type TaskRow,
} from './taskRecordQuery';

export async function getTaskList(actor: AccessTokenPayload, query: TaskListQuery) {
  const cursor = decodeCursor(query.cursor);
  const direction = query.direction;
  const today = sql`(NOW() AT TIME ZONE 'America/Toronto')::date`;
  const displayStatus = sql`CASE
    WHEN task.status = 'open' AND task.start_date > ${today} THEN 'upcoming'
    WHEN task.status = 'open' AND task.due_date < ${today} THEN 'overdue'
    WHEN task.status = 'open' THEN 'active'
    ELSE task.status
  END`;
  const sortValue = {
    firstName: sql`LOWER(staff.first_name)`, lastName: sql`LOWER(staff.last_name)`, title: sql`LOWER(task.title)`,
    category: sql`task.category::text`, program: sql`LOWER(COALESCE(program.name, ''))`,
    startDate: sql`task.start_date::text`, dueDate: sql`task.due_date::text`, status: displayStatus,
  }[query.sort]!;
  const search = query.search ? `%${query.search}%` : null;
  const rows = await sql<Array<TaskRow & { cursorValue: string }>>`
    SELECT * FROM (SELECT ${taskRecordColumns},
      ${sortValue} AS cursor_value
    ${taskRecordFrom}
    WHERE ${taskReadScopePredicate(actor, sql`task.staff_id`)}
      AND ${query.staffIds.length ? sql`task.staff_id = ANY(${sql.array(query.staffIds)}::uuid[])` : sql`TRUE`}
      AND ${query.programIds.length ? sql`(${query.programIds.includes('general') ? sql`task.program_id IS NULL OR` : sql``}
        task.program_id = ANY(${sql.array(query.programIds.filter(id => id !== 'general'))}::uuid[]))` : sql`TRUE`}
      AND ${query.categories.length ? sql`task.category::text = ANY(${sql.array(query.categories)}::text[])` : sql`TRUE`}
      AND ${query.statuses.length ? sql`(
        (${query.statuses.includes('upcoming')} AND task.status = 'open' AND task.start_date > ${today})
        OR (${query.statuses.includes('active')} AND task.status = 'open' AND task.start_date <= ${today} AND task.due_date >= ${today})
        OR (${query.statuses.includes('overdue')} AND task.status = 'open' AND task.due_date < ${today})
        OR (${query.statuses.includes('completed')} AND task.status = 'completed')
        OR (${query.statuses.includes('cancelled')} AND task.status = 'cancelled')
      )` : sql`TRUE`}
      AND ${search ? sql`CONCAT_WS(' ', task.title, task.details, program.name, staff.first_name, staff.last_name) ILIKE ${search}` : sql`TRUE`}
    ) listed
    WHERE ${cursor ? (direction === 'asc'
      ? sql`(listed.cursor_value > ${cursor.value} OR (listed.cursor_value = ${cursor.value} AND listed.id > ${cursor.id}::uuid))`
      : sql`(listed.cursor_value < ${cursor.value} OR (listed.cursor_value = ${cursor.value} AND listed.id < ${cursor.id}::uuid))`) : sql`TRUE`}
    ORDER BY listed.cursor_value ${direction === 'asc' ? sql`ASC` : sql`DESC`}, listed.id ${direction === 'asc' ? sql`ASC` : sql`DESC`}
    LIMIT ${(query.limit ?? 25) + 1}
  `;
  const detailed = attachTaskDetails(rows, await loadTaskLoggedHours(rows.map(row => row.id)), actor);
  return cursorPage(detailed, query.limit ?? 25);
}
