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
    age: sql`COALESCE(LPAD(EXTRACT(YEAR FROM AGE(CURRENT_DATE, yp.date_of_birth))::int::text, 4, '0'), '')`,
    school: sql`LOWER(COALESCE(s.name, ''))`,
    grade: sql`COALESCE(LPAD(yp.grade_level::text, 4, '0'), '')`,
    program: sql`LOWER(COALESCE((SELECT MIN(p_sort.name) FROM cohort_enrollments ce_sort INNER JOIN program_cohorts pc_sort ON pc_sort.id = ce_sort.cohort_id INNER JOIN programs p_sort ON p_sort.id = pc_sort.program_id WHERE ce_sort.youth_id = u.id AND ce_sort.withdrawn_on IS NULL), ''))`,
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
