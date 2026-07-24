import { sql } from '../../db/client';
import type { YouthQuery } from '../../validation/youthSchemas';

function escapeLikePattern(value: string) {
  return value.replace(/[\\%_]/g, character => `\\${character}`);
}

/** Builds the parameterized filters for youth profile list queries. */
export function applyYouthFilters(filters: YouthQuery) {
  const activeEnrollment = sql`EXISTS (
    SELECT 1
    FROM cohort_enrollments current_enrollment
    INNER JOIN program_cohorts current_cohort
      ON current_cohort.id = current_enrollment.cohort_id
    WHERE current_enrollment.youth_id = yp.user_id
      AND current_enrollment.enrolled_on <= (NOW() AT TIME ZONE 'America/Toronto')::date
      AND (
        current_enrollment.withdrawn_on IS NULL
        OR current_enrollment.withdrawn_on > (NOW() AT TIME ZONE 'America/Toronto')::date
      )
      AND (NOW() AT TIME ZONE 'America/Toronto')::date
        BETWEEN current_cohort.starts_on AND current_cohort.ends_on
  )`;
  const statusFilter = filters.statuses.length !== 1
    ? sql`TRUE`
    : filters.statuses[0] === 'active'
      ? activeEnrollment
      : sql`NOT (${activeEnrollment})`;
  const programFilter = filters.programIds.length
    ? sql`EXISTS (
        SELECT 1
        FROM cohort_enrollments cef
        INNER JOIN program_cohorts pcf ON pcf.id = cef.cohort_id
        WHERE cef.youth_id = yp.user_id
          AND pcf.program_id = ANY(${sql.array(filters.programIds)}::uuid[])
          AND cef.withdrawn_on IS NULL
      )`
    : sql`TRUE`;
  const cohortFilter = filters.cohortIds.length
    ? sql`EXISTS (
        SELECT 1
        FROM cohort_enrollments cohort_filter_enrollment
        WHERE cohort_filter_enrollment.youth_id = yp.user_id
          AND cohort_filter_enrollment.cohort_id = ANY(${sql.array(filters.cohortIds)}::uuid[])
          AND cohort_filter_enrollment.withdrawn_on IS NULL
      )`
    : sql`TRUE`;
  const searchFilter = filters.search
    ? sql`(
        CONCAT_WS(' ', u.first_name, u.last_name, s.name) ILIKE ${`%${escapeLikePattern(filters.search)}%`} ESCAPE '\\'
        OR EXISTS (
          SELECT 1
          FROM cohort_enrollments ces
          INNER JOIN program_cohorts pcs ON pcs.id = ces.cohort_id
          INNER JOIN programs ps ON ps.id = pcs.program_id
          WHERE ces.youth_id = yp.user_id
            AND CONCAT_WS(' ', ps.name, pcs.name) ILIKE ${`%${escapeLikePattern(filters.search)}%`} ESCAPE '\\'
        )
      )`
    : sql`TRUE`;

  return sql`${statusFilter} AND ${programFilter} AND ${cohortFilter} AND ${searchFilter}`;
}
