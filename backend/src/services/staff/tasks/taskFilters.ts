import { sql } from '../../../db/client';
import type { TaskListQuery } from '../../../validation/taskSchemas';
import { TASK_CATEGORY_OPTIONS } from './taskReferenceData';

type TaskFilters = Pick<
  TaskListQuery,
  'staffIds' | 'programIds' | 'categories' | 'statuses' | 'search'
>;

export function buildTaskFilters(filters: TaskFilters) {
  const today = sql`(NOW() AT TIME ZONE 'America/Toronto')::date`;
  const status = sql`CASE
    WHEN task.status = 'open' AND task.start_date > ${today} THEN 'upcoming'
    WHEN task.status = 'open' AND task.due_date < ${today} THEN 'overdue'
    WHEN task.status = 'open' THEN 'in_progress'
    ELSE task.status
  END`;
  const search = filters.search ? `%${filters.search}%` : null;
  const matchingCategories = getMatchingCategories(filters.search);
  const predicate = sql`
    ${filters.staffIds.length ? sql`task.staff_id = ANY(${sql.array(filters.staffIds)}::uuid[])` : sql`TRUE`}
    AND ${filters.programIds.length ? sql`(${filters.programIds.includes('general') ? sql`task.program_id IS NULL OR` : sql``}
      task.program_id = ANY(${sql.array(filters.programIds.filter(id => id !== 'general'))}::uuid[]))` : sql`TRUE`}
    AND ${filters.categories.length ? sql`task.category::text = ANY(${sql.array(filters.categories)}::text[])` : sql`TRUE`}
    AND ${filters.statuses.length ? sql`(
      (${filters.statuses.includes('upcoming')} AND task.status = 'open' AND task.start_date > ${today})
      OR (${filters.statuses.includes('in_progress')} AND task.status = 'open' AND task.start_date <= ${today} AND task.due_date >= ${today})
      OR (${filters.statuses.includes('overdue')} AND task.status = 'open' AND task.due_date < ${today})
      OR (${filters.statuses.includes('completed')} AND task.status = 'completed')
      OR (${filters.statuses.includes('cancelled')} AND task.status = 'cancelled')
    )` : sql`TRUE`}
    AND ${search ? sql`(
      CONCAT_WS(' ', task.title, task.details, program.name, staff.first_name, staff.last_name) ILIKE ${search}
      OR ${matchingCategories.length
        ? sql`task.category::text = ANY(${sql.array(matchingCategories)}::text[])`
        : sql`FALSE`}
    )` : sql`TRUE`}
  `;

  return { status, predicate };
}

function getMatchingCategories(search: string | undefined) {
  if (!search) return [];
  const normalizedSearch = search.toLocaleLowerCase();
  return TASK_CATEGORY_OPTIONS
    .filter(option => (
      option.label.toLocaleLowerCase().includes(normalizedSearch)
      || option.value.toLocaleLowerCase().includes(normalizedSearch)
    ))
    .map(option => option.value);
}
