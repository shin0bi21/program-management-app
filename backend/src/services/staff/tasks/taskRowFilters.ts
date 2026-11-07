import { sql } from '../../../db/client';
import type { TaskListQuery } from '../../../validation/taskSchemas';
import { resolveCycleDateRange } from '../../programming/cycles/cycleDateRange';
import { TASK_CATEGORY_OPTIONS } from './taskReferenceData';

type TaskFilters = Pick<
  TaskListQuery,
  'staffIds' | 'programIds' | 'categories' | 'statuses' | 'search'
>;

/**
 * Builds filters for table and calendar items.
 * @param filterValues - Validated staff, program, category, status, and search selections.
 * @example buildTaskFilters(filterValues) // applied filters and displayed status
 */
export function buildTaskFilters(filterValues: TaskFilters) {
  // 1. Work out the displayed task status.
  const today = sql`(NOW() AT TIME ZONE 'America/Toronto')::date`;
  const status = sql`
    CASE
      WHEN "row".state = 'open' AND "row".start_date::date > ${today} THEN 'upcoming'
      WHEN "row".state = 'open' AND "row".due_date::date < ${today} THEN 'overdue'
      WHEN "row".state = 'open' THEN 'in_progress'
      ELSE "row".state
    END
  `;

  // 2. Collect the selected filters.
  const filters = [];
  if (filterValues.staffIds.length) {
    filters.push(sql`task.staff_id = ANY(${sql.array(filterValues.staffIds)}::uuid[])`);
  }
  if (filterValues.programIds.length) {
    const programIds = filterValues.programIds.filter(id => id !== 'general');
    let programFilter = sql`task.program_id = ANY(${sql.array(programIds)}::uuid[])`;
    if (filterValues.programIds.includes('general')) {
      programFilter = sql`(
        task.program_id IS NULL
        OR ${programFilter}
      )`;
    }
    filters.push(programFilter);
  }
  if (filterValues.categories.length) {
    filters.push(sql`task.category::text = ANY(${sql.array(filterValues.categories)}::text[])`);
  }
  if (filterValues.statuses.length) {
    filters.push(sql`(
      (${filterValues.statuses.includes('upcoming')} AND task.state = 'open' AND task.start_date > ${today})
      OR (${filterValues.statuses.includes('in_progress')} AND task.state = 'open' AND task.start_date <= ${today} AND task.due_date >= ${today})
      OR (${filterValues.statuses.includes('overdue')} AND task.state = 'open' AND task.due_date < ${today})
      OR (${filterValues.statuses.includes('completed')} AND task.state = 'completed')
      OR (${filterValues.statuses.includes('cancelled')} AND task.state = 'cancelled')
    )`);
  }
  if (filterValues.search) {
    const search = `%${filterValues.search}%`;
    const matchingCategories = getMatchingCategories(filterValues.search);
    filters.push(sql`(
      CONCAT_WS(' ', task.title, task.details, program.name, staff.first_name, staff.last_name) ILIKE ${search}
      OR task.category::text = ANY(${sql.array(matchingCategories)}::text[])
    )`);
  }

  // 3. Apply the selected filters.
  let appliedFilters = sql`TRUE`;
  for (const filter of filters) {
    appliedFilters = sql`${appliedFilters} AND ${filter}`;
  }
  return { status, appliedFilters };
}

/**
 * Limits the selected cycle dates to the requested range.
 * @param query - Validated cycle selections and optional paired date bounds.
 * @example resolveTaskDateRange(query) // intersected dates, or null
 */
export async function resolveTaskDateRange(query: Pick<TaskListQuery, 'cycleIds' | 'start' | 'end'>) {
  // 1. Find the selected cycle dates.
  const cycles = await resolveCycleDateRange(sql, query.cycleIds);
  if (!cycles) return null;

  // 2. Keep the dates within the requested range.
  const start = query.start && query.start > cycles.start ? query.start : cycles.start;
  const end = query.end && query.end < cycles.end ? query.end : cycles.end;

  return start <= end ? { start, end } : null;
}

/**
 * Finds task categories whose label or value matches search text.
 * @param search - Optional case-insensitive search text.
 * @example getMatchingCategories('meeting') // matching stored category values
 */
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
