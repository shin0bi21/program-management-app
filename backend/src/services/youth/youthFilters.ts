import { sql } from '../../db/client';
import type { YouthQuery } from '../../validation/youthSchemas';

/** Builds the parameterized filters for the youth profile list query. */
export function applyYouthFilters(filters: YouthQuery) {
  const activeEnrollmentExists = (programIds: string[] = [], cycleIds: string[] = []) => sql`EXISTS (
    SELECT 1
    FROM cohort_enrollments current_enrollment
    INNER JOIN program_cohorts current_cohort
      ON current_cohort.id = current_enrollment.cohort_id
    INNER JOIN program_cycles current_cycle ON current_cycle.id = current_cohort.cycle_id
    WHERE current_enrollment.youth_id = yp.user_id
      AND current_enrollment.enrolled_on <= (NOW() AT TIME ZONE 'America/Toronto')::date
      AND (
        current_enrollment.withdrawn_on IS NULL
        OR current_enrollment.withdrawn_on > (NOW() AT TIME ZONE 'America/Toronto')::date
      )
      AND (NOW() AT TIME ZONE 'America/Toronto')::date
        BETWEEN current_cycle.starts_on AND current_cycle.ends_on
      ${programIds.length
        ? sql`AND current_cohort.program_id = ANY(${sql.array(programIds)}::uuid[])`
        : sql``}
      ${cycleIds.length
        ? sql`AND current_cohort.cycle_id = ANY(${sql.array(cycleIds)}::uuid[])`
        : sql``}
  )`;

  const activeEnrollment = activeEnrollmentExists();
  const activeOnly = filters.statuses.length === 1 && filters.statuses[0] === 'active';
  const statusFilter = filters.statuses.length !== 1
    ? sql`TRUE`
    : activeOnly
      ? activeEnrollment
      : sql`NOT (${activeEnrollment})`;

  const hasParticipationFilter = filters.programIds.length > 0 || filters.cycleIds.length > 0;

  // Program and cycle selections must describe the same participation.
  let participationFilter = sql`TRUE`;
  if (hasParticipationFilter && activeOnly) {
    participationFilter = activeEnrollmentExists(filters.programIds, filters.cycleIds);
  } else if (hasParticipationFilter) {
    participationFilter = sql`(
        EXISTS (
          SELECT 1
          FROM cohort_enrollments cef
          INNER JOIN program_cohorts pcf ON pcf.id = cef.cohort_id
          WHERE cef.youth_id = yp.user_id
            ${filters.programIds.length
              ? sql`AND pcf.program_id = ANY(${sql.array(filters.programIds)}::uuid[])`
              : sql``}
            ${filters.cycleIds.length
              ? sql`AND pcf.cycle_id = ANY(${sql.array(filters.cycleIds)}::uuid[])`
              : sql``}
            AND cef.withdrawn_on IS NULL
        )
        OR EXISTS (
          SELECT 1
          FROM attendance_records program_attendance
          INNER JOIN cohort_sessions program_session ON program_session.id = program_attendance.session_id
          INNER JOIN program_cohorts program_cohort ON program_cohort.id = program_session.cohort_id
          INNER JOIN programs attendance_program ON attendance_program.id = program_cohort.program_id
          WHERE program_attendance.youth_id = yp.user_id
            AND attendance_program.roster_mode = 'open'
            ${filters.programIds.length
              ? sql`AND attendance_program.id = ANY(${sql.array(filters.programIds)}::uuid[])`
              : sql``}
            ${filters.cycleIds.length
              ? sql`AND program_cohort.cycle_id = ANY(${sql.array(filters.cycleIds)}::uuid[])`
              : sql``}
        )
      )`;
  }

  const searchFilter = filters.search
    ? sql`(
        CONCAT_WS(' ', u.first_name, u.last_name, s.name) ILIKE ${`%${escapeLikePattern(filters.search)}%`} ESCAPE '\\'
        OR EXISTS (
          SELECT 1
          FROM cohort_enrollments ces
          INNER JOIN program_cohorts pcs ON pcs.id = ces.cohort_id
          INNER JOIN program_cycles cycle_search ON cycle_search.id = pcs.cycle_id
          INNER JOIN programs ps ON ps.id = pcs.program_id
          WHERE ces.youth_id = yp.user_id
            AND CONCAT_WS(' ', ps.name, cycle_search.name) ILIKE ${`%${escapeLikePattern(filters.search)}%`} ESCAPE '\\'
        )
        OR EXISTS (
          SELECT 1
          FROM attendance_records search_attendance
          INNER JOIN cohort_sessions search_session ON search_session.id = search_attendance.session_id
          INNER JOIN program_cohorts search_cohort ON search_cohort.id = search_session.cohort_id
          INNER JOIN program_cycles search_cycle ON search_cycle.id = search_cohort.cycle_id
          INNER JOIN programs search_program ON search_program.id = search_cohort.program_id
          WHERE search_attendance.youth_id = yp.user_id
            AND search_program.roster_mode = 'open'
            AND CONCAT_WS(' ', search_program.name, search_cycle.name)
              ILIKE ${`%${escapeLikePattern(filters.search)}%`} ESCAPE '\\'
        )
      )`
    : sql`TRUE`;

  return sql`${statusFilter} AND ${participationFilter} AND ${searchFilter}`;
}

function escapeLikePattern(value: string) {
  return value.replace(/[\\%_]/g, character => `\\${character}`);
}
