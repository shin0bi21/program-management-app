import { sql } from '../../db/client';
import type { YouthQuery } from '../../validation/youthSchemas';
import { cursorPage, decodeCursor } from '../shared/cursorPagination';
import { applyYouthFilters } from './youthFilters';
import {
  youthActiveStatus,
  youthRecordColumns,
  youthRecordFrom,
  type YouthRecordRow,
} from './youthRecordQuery';

export type YouthListRow = YouthRecordRow;

export async function listYouth(filters: YouthQuery) {
  const where = applyYouthFilters(filters);
  const cursor = decodeCursor(filters.cursor);
  const sortValue = ({
    firstName: sql`LOWER(u.first_name)`,
    lastName: sql`LOWER(u.last_name)`,
    dateOfBirth: sql`COALESCE(yp.date_of_birth::text, '')`,
    school: sql`LOWER(COALESCE(s.name, ''))`,
    activePrograms: sql`LOWER(COALESCE((
      SELECT MIN(p_sort.name)
      FROM program_enrollments ce_sort
      INNER JOIN programs p_sort ON p_sort.id = ce_sort.program_id
      INNER JOIN program_cycles cycle_sort ON cycle_sort.id = ce_sort.cycle_id
      WHERE ce_sort.youth_id = u.id
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
      WHERE ce_sort.youth_id = u.id
        AND p_sort.enrollment_required = TRUE
        AND ce_sort.enrolled_on <= cycle_sort.ends_on
        AND ce_sort.withdrawn_on IS NULL
        AND cycle_sort.ends_on < (NOW() AT TIME ZONE 'America/Toronto')::date
    ), ''))`,
    status: youthActiveStatus,
  }[filters.sort]!);
  const youth = await sql<Array<YouthListRow & { cursorValue: string }>>`
    SELECT
      ${youthRecordColumns},
      ${sortValue} AS cursor_value
    ${youthRecordFrom}
    WHERE ur.name = 'youth'
      AND ${where}
      AND ${cursor ? (filters.direction === 'asc'
        ? sql`(${sortValue}, u.id) > (${cursor.value}, ${cursor.id}::uuid)`
        : sql`(${sortValue}, u.id) < (${cursor.value}, ${cursor.id}::uuid)`) : sql`TRUE`}
    ORDER BY ${sortValue} ${filters.direction === 'desc' ? sql`DESC` : sql`ASC`}, u.id ${filters.direction === 'desc' ? sql`DESC` : sql`ASC`}
    ${filters.limit ? sql`LIMIT ${filters.limit + 1}` : sql``}
  `;
  return filters.limit ? cursorPage(youth, filters.limit) : youth.map(({ cursorValue: _cursorValue, ...row }) => row) as YouthListRow[];
}
