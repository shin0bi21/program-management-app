import { sql } from '../../db/client';
import type { YouthQuery } from '../../validation/youthSchemas';
import { paginateQuery } from '../shared/cursorPagination';
import { buildYouthFilters } from './youthRowFilters';
import {
  getYouthRows,
  type YouthRow,
} from './youthRowQuery';

/**
 * Lists matching youth profiles.
 * @param filterValues - Validated domain filters, ordering, and optional cursor-page inputs.
 * @returns A cursor page when limited, otherwise all matching youth rows in the requested order.
 * @example listYouth(filterValues) // { rows, nextCursor } when filterValues.limit is set
 */
export function listYouth(filterValues: YouthQuery) {
  // 1. Restrict the canonical profile query to youth and the requested filters.
  const appliedFilters = buildYouthFilters(filterValues);
  const rowsQuery = getYouthRows(appliedFilters);

  // 2. Keep list-only sort calculations outside the canonical profile projection.
  const sortValue = ({
    firstName: sql`LOWER("row".first_name)`,
    lastName: sql`LOWER("row".last_name)`,
    dateOfBirth: sql`COALESCE("row".date_of_birth::text, '')`,
    school: sql`LOWER(COALESCE("row".school_name, ''))`,
    activePrograms: sql`LOWER(COALESCE((
      SELECT MIN(p_sort.name)
      FROM program_enrollments ce_sort
      INNER JOIN programs p_sort ON p_sort.id = ce_sort.program_id
      INNER JOIN program_cycles cycle_sort ON cycle_sort.id = ce_sort.cycle_id
      WHERE ce_sort.youth_id = "row".id
        AND p_sort.enrollment_required = TRUE
        AND ce_sort.enrolled_on <= (NOW() AT TIME ZONE 'America/Toronto')::date
        AND (ce_sort.withdrawn_on IS NULL OR ce_sort.withdrawn_on > (NOW() AT TIME ZONE 'America/Toronto')::date)
        AND (NOW() AT TIME ZONE 'America/Toronto')::date BETWEEN cycle_sort.starts_on AND cycle_sort.ends_on
    ), ''))`,
    completedPrograms: sql`LOWER(COALESCE((
      SELECT MIN(p_sort.name)
      FROM program_enrollments ce_sort
      INNER JOIN programs p_sort ON p_sort.id = ce_sort.program_id
      INNER JOIN program_cycles cycle_sort ON cycle_sort.id = ce_sort.cycle_id
      WHERE ce_sort.youth_id = "row".id
        AND p_sort.enrollment_required = TRUE
        AND ce_sort.enrolled_on <= cycle_sort.ends_on
        AND ce_sort.withdrawn_on IS NULL
        AND cycle_sort.ends_on < (NOW() AT TIME ZONE 'America/Toronto')::date
    ), ''))`,
    status: sql`"row".status`,
  }[filterValues.sort]!);

  // 3. Return the requested list or page.
  if (filterValues.limit === undefined) {
    const sortDirection = filterValues.direction === 'asc' ? sql`ASC` : sql`DESC`;
    return sql<YouthRow[]>`
      SELECT "row".*
      FROM (${rowsQuery}) "row"
      ORDER BY ${sortValue} ${sortDirection}, "row".id ${sortDirection}
    `;
  }

  return paginateQuery(rowsQuery, {
    sortValue,
    direction: filterValues.direction,
    cursor: filterValues.cursor,
    limit: filterValues.limit,
  });
}
