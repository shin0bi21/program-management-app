import { sql } from '../../../db/client';
import { taskReadScopePredicate } from '../../../policies/taskPolicy';
import type { AccessTokenPayload } from '../../../types/auth';
import type { TaskCalendarQuery } from '../../../validation/taskSchemas';
import { buildTaskFilters, resolveTaskDateRange } from './taskFilters';
import {
  attachTaskDetails,
  loadTaskLoggedHours,
  taskRecordColumns,
  taskRecordFrom,
  type TaskRow,
} from './taskRecordQuery';

export async function getTasksCalendarData(
  actor: AccessTokenPayload,
  query: TaskCalendarQuery,
) {
  const range = await resolveTaskDateRange(query);
  if (!range) return [];

  const { predicate } = buildTaskFilters(query);
  const rows = await sql<TaskRow[]>`
    SELECT ${taskRecordColumns}
    ${taskRecordFrom}
    WHERE task.start_date <= ${range.end}::date
      AND task.due_date >= ${range.start}::date
      AND ${taskReadScopePredicate(actor, sql`task.staff_id`)}
      AND ${predicate}
    ORDER BY task.start_date, task.due_date, task.title, task.id
  `;
  return attachTaskDetails(rows, await loadTaskLoggedHours(rows.map(row => row.id)), actor);
}
