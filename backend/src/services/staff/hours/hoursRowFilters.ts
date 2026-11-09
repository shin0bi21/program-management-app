import { sql } from '../../../db/client';
import type { HoursTableQuery } from '../../../validation/hoursSchemas';
import { hoursSearchValue } from './hoursRowQuery';

/**
 * Builds filters for table and calendar items.
 * @param filterValues - Validated staff/category/program/type/cycle/search selections; general matches no program.
 * @returns Combined SQL restrictions against the canonical hours relationships.
 * @example buildHoursFilters(filterValues) // TRUE when no filters are selected
 */
export function buildHoursFilters(filterValues: Pick<HoursTableQuery, 'staffIds' | 'categories' | 'programIds' | 'types' | 'cycleIds' | 'search'>) {
  // 1. Collect only the selected restrictions.
  const filters = [];
  if (filterValues.staffIds.length) {
    filters.push(sql`entry.staff_id = ANY(${sql.array(filterValues.staffIds)}::uuid[])`);
  }
  if (filterValues.categories.length) {
    filters.push(sql`entry.category::text = ANY(${sql.array(filterValues.categories)}::text[])`);
  }
  if (filterValues.cycleIds.length) {
    filters.push(sql`entry.cycle_id = ANY(${sql.array(filterValues.cycleIds)}::uuid[])`);
  }
  if (filterValues.search) {
    filters.push(sql`${hoursSearchValue} ILIKE ${`%${filterValues.search}%`}`);
  }

  // 2. Include unassigned entries when the general program is selected.
  if (filterValues.programIds.length) {
    const programIds = filterValues.programIds.filter(id => id !== 'general');
    let programFilter = sql`entry.program_id = ANY(${sql.array(programIds)}::uuid[])`;
    if (filterValues.programIds.includes('general')) {
      programFilter = sql`(
        entry.program_id IS NULL
        OR ${programFilter}
      )`;
    }
    filters.push(programFilter);
  }

  // 3. Filter by the entry's task, session, or regular source.
  if (filterValues.types.length) {
    const entryType = sql`
      CASE
        WHEN entry.task_id IS NOT NULL THEN 'task'
        WHEN entry.session_id IS NOT NULL THEN 'session'
        ELSE 'regular'
      END
    `;
    filters.push(sql`${entryType} = ANY(${sql.array(filterValues.types)}::text[])`);
  }

  // 4. Combine the selected restrictions.
  let appliedFilters = sql`TRUE`;
  for (const filter of filters) {
    appliedFilters = sql`
      ${appliedFilters}
      AND ${filter}
    `;
  }
  return appliedFilters;
}
