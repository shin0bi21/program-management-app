import { sql } from '../../db/client';
import type { YouthQuery } from '../../validation/youthSchemas';

/**
 * Builds program, cycle, school, and search conditions for the youth profile query.
 * @param filterValues - Selected program, cycle, and school IDs and search text after request validation.
 * @example buildYouthFilters(filterValues) // SQL conditions for canonical youth rows
 */
export function buildYouthFilters(filterValues: YouthQuery) {
  // 1. Collect the selected filters.
  const filters = [];

  if (filterValues.programIds.length || filterValues.cycleIds.length) {
    let enrollmentFilters = sql``;
    let attendanceFilters = sql``;
    if (filterValues.programIds.length) {
      const programIds = sql.array(filterValues.programIds);
      enrollmentFilters = sql`AND enrollment.program_id = ANY(${programIds}::uuid[])`;
      attendanceFilters = sql`AND attendance_program.id = ANY(${programIds}::uuid[])`;
    }
    if (filterValues.cycleIds.length) {
      const cycleIds = sql.array(filterValues.cycleIds);
      enrollmentFilters = sql`${enrollmentFilters} AND enrollment.cycle_id = ANY(${cycleIds}::uuid[])`;
      attendanceFilters = sql`${attendanceFilters} AND program_session.cycle_id = ANY(${cycleIds}::uuid[])`;
    }
    filters.push(sql`(
        EXISTS (
          SELECT 1
          FROM program_enrollments enrollment
          WHERE enrollment.youth_id = profile.user_id
            ${enrollmentFilters}
            AND enrollment.withdrawn_on IS NULL
        )
        OR EXISTS (
          SELECT 1
          FROM attendance_records program_attendance
          INNER JOIN program_sessions program_session ON program_session.id = program_attendance.session_id
          INNER JOIN programs attendance_program ON attendance_program.id = program_session.program_id
          WHERE program_attendance.youth_id = profile.user_id
            AND attendance_program.enrollment_required = FALSE
            ${attendanceFilters}
        )
      )`);
  }

  if (filterValues.schoolIds.length) {
    filters.push(sql`profile.school_id = ANY(${sql.array(filterValues.schoolIds)}::uuid[])`);
  }

  if (filterValues.search) {
    const search = `%${escapeLikePattern(filterValues.search)}%`;
    filters.push(sql`(
        CONCAT_WS(' ', youth.first_name, youth.last_name, school.name) ILIKE ${search} ESCAPE '\\'
        OR EXISTS (
          SELECT 1
          FROM program_enrollments search_enrollment
          INNER JOIN program_cycles search_cycle ON search_cycle.id = search_enrollment.cycle_id
          INNER JOIN programs search_program ON search_program.id = search_enrollment.program_id
          WHERE search_enrollment.youth_id = profile.user_id
            AND CONCAT_WS(' ', search_program.title, search_cycle.title) ILIKE ${search} ESCAPE '\\'
        )
        OR EXISTS (
          SELECT 1
          FROM attendance_records search_attendance
          INNER JOIN program_sessions search_session ON search_session.id = search_attendance.session_id
          INNER JOIN program_cycles search_cycle ON search_cycle.id = search_session.cycle_id
          INNER JOIN programs search_program ON search_program.id = search_session.program_id
          WHERE search_attendance.youth_id = profile.user_id
            AND search_program.enrollment_required = FALSE
            AND CONCAT_WS(' ', search_program.title, search_cycle.title)
              ILIKE ${search} ESCAPE '\\'
        )
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
 * Escapes LIKE metacharacters so youth search matches the entered text literally.
 * @param value - Text to match literally, before adding search wildcards.
 * @example escapeLikePattern('100%') // '100\\%'
 */
function escapeLikePattern(value: string) {
  return value.replace(/[\\%_]/g, character => `\\${character}`);
}
