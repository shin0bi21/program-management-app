import { sql } from '../../../db/client';
import { programAccessPredicate } from '../../../policies/programAccessPolicy';
import type { AccessTokenPayload } from '../../../types/auth';
import type { SessionListQuery } from '../../../validation/cohortSchemas';
import { cursorPage, decodeCursor } from '../../shared/cursorPagination';

export function listSessions(actor: AccessTokenPayload, filters: SessionListQuery) {
  const search = filters.search ? `%${filters.search}%` : null;
  const completedOnly = filters.statuses.length === 1 && filters.statuses[0] === 'completed';
  const cursor = decodeCursor(filters.cursor);
  const direction = filters.limit ? filters.direction : filters.start ? 'asc' : filters.direction;
  const state = sql`CASE WHEN cs.cancelled_at IS NOT NULL THEN 'cancelled' WHEN cs.ends_at < NOW() THEN 'completed' ELSE 'upcoming' END`;
  const sortValue = {
    program: sql`LOWER(p.name)`, cohort: sql`LOWER(cycle.name)`, theme: sql`LOWER(COALESCE(cs.theme, ''))`,
    date: sql`cs.starts_at::text`, time: sql`cs.starts_at::text`, type: sql`LOWER(st.name)`, status: state,
  }[filters.sort]!;
  return sql<Array<{ id: string; cursorValue: string }>>`
    SELECT
      cs.id, cs.cohort_id, cs.session_type_id, st.name AS session_type_name, cs.theme,
      cycle.name AS cohort_name, p.id AS program_id, p.name AS program_name, p.enrollment_required,
      cs.starts_at, cs.ends_at, cs.cancelled_at, cs.description,
      COUNT(ar.id)::int AS attendance_marked_count,
      COUNT(ar.id) FILTER (WHERE ar.status IN ('present', 'late'))::int AS attended_count,
      ROUND(
        100.0 * COUNT(ar.id) FILTER (WHERE ar.status IN ('present', 'late'))
        / NULLIF(COUNT(ar.id) FILTER (WHERE ar.status != 'excused'), 0), 1
      )::float AS attendance_rate,
      ${state} AS state,
      ${sortValue} AS cursor_value
    FROM cohort_sessions cs
    INNER JOIN session_types st ON st.id = cs.session_type_id
    INNER JOIN program_cohorts pc ON pc.id = cs.cohort_id
    INNER JOIN program_cycles cycle ON cycle.id = pc.cycle_id
    INNER JOIN programs p ON p.id = pc.program_id
    LEFT JOIN attendance_records ar ON ar.session_id = cs.id
    WHERE ${filters.start && filters.end
      ? sql`cs.starts_at < ${filters.end}::timestamptz AND cs.ends_at > ${filters.start}::timestamptz`
      : sql`TRUE`}
      AND ${filters.programIds.length ? sql`pc.program_id = ANY(${sql.array(filters.programIds)}::uuid[])` : sql`TRUE`}
      AND ${filters.cycleIds.length ? sql`pc.cycle_id = ANY(${sql.array(filters.cycleIds)}::uuid[])` : sql`TRUE`}
      AND ${filters.cohortId ? sql`pc.id = ${filters.cohortId}` : sql`TRUE`}
      AND ${filters.sessionTypeIds.length ? sql`cs.session_type_id = ANY(${sql.array(filters.sessionTypeIds)}::uuid[])` : sql`TRUE`}
      AND ${programAccessPredicate(actor, sql`pc.program_id`)}
      AND ${filters.statuses.length === 1
        ? (completedOnly ? sql`cs.ends_at < NOW()` : sql`cs.ends_at >= NOW()`)
        : sql`TRUE`}
      AND ${search ? sql`(
        COALESCE(cs.theme, '') ILIKE ${search}
        OR COALESCE(cs.description, '') ILIKE ${search}
        OR cycle.name ILIKE ${search}
        OR p.name ILIKE ${search}
        OR st.name ILIKE ${search}
      )` : sql`TRUE`}
      AND ${cursor ? (direction === 'asc'
        ? sql`(${sortValue}, cs.id) > (${cursor.value}, ${cursor.id}::uuid)`
        : sql`(${sortValue}, cs.id) < (${cursor.value}, ${cursor.id}::uuid)`) : sql`TRUE`}
    GROUP BY cs.id, pc.id, p.id, cycle.id, st.id
    ORDER BY ${sortValue} ${direction === 'asc' ? sql`ASC` : sql`DESC`}, cs.id ${direction === 'asc' ? sql`ASC` : sql`DESC`}
    ${filters.limit ? sql`LIMIT ${filters.limit + 1}` : sql``}
  `.then(rows => filters.limit ? cursorPage(rows, filters.limit) : rows.map(({ cursorValue: _cursorValue, ...row }) => row));
}
