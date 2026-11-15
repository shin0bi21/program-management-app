import { sql } from '../../../db/client';
import type { TaskListQuery } from '../../../validation/taskSchemas';
import { resolveCycleDateRange } from '../../programming/cycles/cycleDateRange';
import { getMatchingReferenceIds } from '../../shared/referenceOptions';
import { TASK_CATEGORY_OPTIONS } from './taskReferenceData';
import { taskStatus } from './taskRowQuery';

type TaskFilters = Pick<
  TaskListQuery,
  'staffIds' | 'programIds' | 'categories' | 'statuses' | 'search'
>;

/**
 * Builds filters for table and calendar items.
 * @param filterValues - Validated staff, program, category, status, and search selections.
 * @returns Combined SQL restrictions using the canonical task status.
 * @example buildTaskFilters(filterValues) // TRUE when no filters are selected
 */
export function buildTaskFilters(filterValues: TaskFilters) {
  // 1. Collect the selected filters.
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
    filters.push(sql`${taskStatus} = ANY(${sql.array(filterValues.statuses)}::text[])`);
  }
  if (filterValues.search) {
    const search = `%${filterValues.search}%`;
    const matchingCategories = getMatchingReferenceIds(TASK_CATEGORY_OPTIONS, filterValues.search);
    filters.push(sql`(
      CONCAT_WS(' ', task.title, task.details, program.name, staff.first_name, staff.last_name) ILIKE ${search}
      OR task.category::text = ANY(${sql.array(matchingCategories)}::text[])
    )`);
  }

  // 2. Apply the selected filters.
  let appliedFilters = sql`TRUE`;
  for (const filter of filters) {
    appliedFilters = sql`${appliedFilters} AND ${filter}`;
  }
  return appliedFilters;
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
