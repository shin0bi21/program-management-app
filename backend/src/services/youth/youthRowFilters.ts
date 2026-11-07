import { sql } from '../../db/client';
import type { YouthQuery } from '../../validation/youthSchemas';

/**
 * Builds filters for table and calendar items.
 * @param filterValues - Validated program, cycle, and search selections.
 * @example buildYouthFilters(filterValues) // SQL conditions for canonical youth rows
 */
export function buildYouthFilters(filterValues: YouthQuery) {
  // 1. Match the selected program and cycle together.
  const filters = [];

  if (filterValues.programIds.length || filterValues.cycleIds.length) {
    let enrollmentFilters = sql``;
    let attendanceFilters = sql``;
    if (filterValues.programIds.length) {
      const programIds = sql.array(filterValues.programIds);
      enrollmentFilters = sql`AND cef.program_id = ANY(${programIds}::uuid[])`;
      attendanceFilters = sql`AND attendance_program.id = ANY(${programIds}::uuid[])`;
    }
    if (filterValues.cycleIds.length) {
      const cycleIds = sql.array(filterValues.cycleIds);
      enrollmentFilters = sql`${enrollmentFilters} AND cef.cycle_id = ANY(${cycleIds}::uuid[])`;
      attendanceFilters = sql`${attendanceFilters} AND program_session.cycle_id = ANY(${cycleIds}::uuid[])`;
    }
    filters.push(sql`(
        EXISTS (
          SELECT 1
          FROM program_enrollments cef
          WHERE cef.youth_id = yp.user_id
            ${enrollmentFilters}
            AND cef.withdrawn_on IS NULL
        )
        OR EXISTS (
          SELECT 1
          FROM attendance_records program_attendance
          INNER JOIN program_sessions program_session ON program_session.id = program_attendance.session_id
          INNER JOIN programs attendance_program ON attendance_program.id = program_session.program_id
          WHERE program_attendance.youth_id = yp.user_id
            AND attendance_program.enrollment_required = FALSE
            ${attendanceFilters}
        )
      )`);
  }

  // 2. Match the search text.
  if (filterValues.search) {
    const search = `%${escapeLikePattern(filterValues.search)}%`;
    filters.push(sql`(
        CONCAT_WS(' ', u.first_name, u.last_name, s.name) ILIKE ${search} ESCAPE '\\'
        OR EXISTS (
          SELECT 1
          FROM program_enrollments ces
          INNER JOIN program_cycles cycle_search ON cycle_search.id = ces.cycle_id
          INNER JOIN programs ps ON ps.id = ces.program_id
          WHERE ces.youth_id = yp.user_id
            AND CONCAT_WS(' ', ps.name, cycle_search.name) ILIKE ${search} ESCAPE '\\'
        )
        OR EXISTS (
          SELECT 1
          FROM attendance_records search_attendance
          INNER JOIN program_sessions search_session ON search_session.id = search_attendance.session_id
          INNER JOIN program_cycles search_cycle ON search_cycle.id = search_session.cycle_id
          INNER JOIN programs search_program ON search_program.id = search_session.program_id
          WHERE search_attendance.youth_id = yp.user_id
            AND search_program.enrollment_required = FALSE
            AND CONCAT_WS(' ', search_program.name, search_cycle.name)
              ILIKE ${search} ESCAPE '\\'
        )
      )`);
  }

  // 3. Apply the selected filters.
  let appliedFilters = sql`TRUE`;
  for (const filter of filters) {
    appliedFilters = sql`${appliedFilters} AND ${filter}`;
  }
  return appliedFilters;
}

/**
 * Escapes LIKE metacharacters so youth search matches the entered text literally.
 * @param value - Search text before surrounding wildcard characters are added.
 * @example escapeLikePattern('name') // 'name'
 */
function escapeLikePattern(value: string) {
  return value.replace(/[\\%_]/g, character => `\\${character}`);
}
