import { sql } from '../../../db/client';
import { programAccessPredicate } from '../../../policies/programAccessPolicy';
import type { AccessTokenPayload } from '../../../types/auth';
import type { CohortQuery } from '../../../validation/cohortSchemas';
import { cursorPage, decodeCursor } from '../../shared/cursorPagination';

export function listCohorts(actor: AccessTokenPayload, query: CohortQuery) {
  const cursor = decodeCursor(query.cursor);
  const state = sql`CASE WHEN CURRENT_DATE < cycle.starts_on THEN 'upcoming' WHEN CURRENT_DATE > cycle.ends_on THEN 'completed' ELSE 'active' END`;
  const sortValue = {
    program: sql`LOWER(p.name)`, cohort: sql`LOWER(cycle.name)`, start: sql`cycle.starts_on::text`,
    end: sql`cycle.ends_on::text`, status: state,
  }[query.sort]!;
  const search = query.search ? `%${query.search}%` : null;
  return sql<Array<{ id: string; cursorValue: string }>>`
    SELECT
      pc.id,
      pc.program_id,
      p.name AS program_name,
      p.roster_mode,
      p.min_age,
      p.max_age,
      cycle.id AS cycle_id,
      cycle.name,
      cycle.name AS cycle_name,
      cycle.starts_on::text AS starts_on,
      cycle.ends_on::text AS ends_on,
      COUNT(DISTINCT ce.youth_id) FILTER (
        WHERE ce.enrolled_on <= CURRENT_DATE
          AND (ce.withdrawn_on IS NULL OR ce.withdrawn_on > CURRENT_DATE)
      )::int AS enrolled_count,
      (
        SELECT MIN(cs.starts_at) FROM cohort_sessions cs
        WHERE cs.cohort_id = pc.id AND cs.starts_at >= NOW() AND cs.cancelled_at IS NULL
      ) AS next_session_at,
      (
        SELECT cs.id FROM cohort_sessions cs
        WHERE cs.cohort_id = pc.id AND cs.starts_at >= NOW() AND cs.cancelled_at IS NULL
        ORDER BY cs.starts_at LIMIT 1
      ) AS next_session_id,
      (
        SELECT ROUND(
          100.0 * COUNT(ar.id) FILTER (WHERE ar.status IN ('present', 'late'))
          / NULLIF(COUNT(ar.id) FILTER (WHERE ar.status != 'excused'), 0), 1
        )::float
        FROM cohort_sessions cs INNER JOIN attendance_records ar ON ar.session_id = cs.id
        WHERE cs.cohort_id = pc.id
      ) AS average_attendance,
      (
        SELECT COUNT(ar.id)::int FROM cohort_sessions cs
        INNER JOIN attendance_records ar ON ar.session_id = cs.id
        WHERE cs.cohort_id = pc.id AND ar.status IN ('present', 'late')
      ) AS attendance_attended_count,
      (
        SELECT COUNT(ar.id)::int FROM cohort_sessions cs
        INNER JOIN attendance_records ar ON ar.session_id = cs.id
        WHERE cs.cohort_id = pc.id AND ar.status != 'excused'
      ) AS attendance_recorded_count,
      (
        SELECT COUNT(DISTINCT ar.youth_id)::int FROM cohort_sessions cs
        INNER JOIN attendance_records ar ON ar.session_id = cs.id
        WHERE cs.cohort_id = pc.id AND ar.status IN ('present', 'late')
      ) AS unique_attendee_count,
      ${state} AS state,
      ${sortValue} AS cursor_value
    FROM program_cohorts pc
    INNER JOIN programs p ON p.id = pc.program_id
    INNER JOIN program_cycles cycle ON cycle.id = pc.cycle_id
    LEFT JOIN cohort_enrollments ce ON ce.cohort_id = pc.id
    WHERE ${query.programId ? sql`pc.program_id = ${query.programId}` : sql`TRUE`}
      AND ${query.scope === 'all' ? sql`TRUE` : programAccessPredicate(actor, sql`pc.program_id`)}
      AND ${query.cycleId ? sql`pc.cycle_id = ${query.cycleId}` : sql`TRUE`}
      AND ${search ? sql`(cycle.name ILIKE ${search} OR p.name ILIKE ${search})` : sql`TRUE`}
      AND ${query.status ? sql`${state} = ${query.status}` : sql`TRUE`}
      AND ${cursor ? (query.direction === 'asc'
        ? sql`(${sortValue}, pc.id) > (${cursor.value}, ${cursor.id}::uuid)`
        : sql`(${sortValue}, pc.id) < (${cursor.value}, ${cursor.id}::uuid)`) : sql`TRUE`}
    GROUP BY pc.id, p.id, cycle.id
    ORDER BY ${sortValue} ${query.direction === 'asc' ? sql`ASC` : sql`DESC`}, pc.id ${query.direction === 'asc' ? sql`ASC` : sql`DESC`}
    ${query.limit ? sql`LIMIT ${query.limit + 1}` : sql``}
  `.then(rows => query.limit ? cursorPage(rows, query.limit) : rows.map(({ cursorValue: _cursorValue, ...row }) => row));
}
