import { sql } from '../../../db/client';
import { programAccessPredicate } from '../../../policies/programAccessPolicy';
import type { AccessTokenPayload } from '../../../types/auth';

export interface CohortRow {
  id: string;
  programId: string;
  programName: string;
  enrollmentRequired: boolean;
  minAge: number | null;
  maxAge: number | null;
  cycleId: string;
  name: string;
  cycleName: string;
  startsOn: string;
  endsOn: string;
  enrolledCount: number;
  nextSessionAt: Date | null;
  nextSessionId: string | null;
  averageAttendance: number | null;
  attendanceAttendedCount: number;
  attendanceRecordedCount: number;
  uniqueAttendeeCount: number;
  state: 'upcoming' | 'active' | 'completed';
}

export const cohortState = sql`CASE WHEN CURRENT_DATE < cycle.starts_on THEN 'upcoming' WHEN CURRENT_DATE > cycle.ends_on THEN 'completed' ELSE 'active' END`;

export const cohortRecordColumns = sql`
  pc.id,
  pc.program_id,
  p.name AS program_name,
  p.enrollment_required,
  p.min_age,
  p.max_age,
  cycle.id AS cycle_id,
  cycle.name,
  cycle.name AS cycle_name,
  cycle.starts_on::text AS starts_on,
  cycle.ends_on::text AS ends_on,
  (SELECT COUNT(DISTINCT ce.youth_id)::int FROM cohort_enrollments ce
    WHERE ce.cohort_id = pc.id AND ce.enrolled_on <= CURRENT_DATE
      AND (ce.withdrawn_on IS NULL OR ce.withdrawn_on > CURRENT_DATE)
  ) AS enrolled_count,
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
  ${cohortState} AS state
`;

export const cohortRecordFrom = sql`
  FROM program_cohorts pc
  INNER JOIN programs p ON p.id = pc.program_id
  INNER JOIN program_cycles cycle ON cycle.id = pc.cycle_id
`;

export function getCohortRowsByIds(database: typeof sql, actor: AccessTokenPayload, ids: readonly string[]) {
  if (!ids.length) return Promise.resolve([] as CohortRow[]);

  return database<CohortRow[]>`
    SELECT ${cohortRecordColumns}
    ${cohortRecordFrom}
    WHERE pc.id = ANY(${sql.array([...ids])}::uuid[])
      AND ${programAccessPredicate(actor, sql`pc.program_id`)}
    ORDER BY pc.id
  `;
}

export async function getCohortYouthIds(database: typeof sql, cohortIds: readonly string[]) {
  if (!cohortIds.length) return [];

  const rows = await database<{ id: string }[]>`
    SELECT youth_id AS id FROM cohort_enrollments
    WHERE cohort_id = ANY(${sql.array([...cohortIds])}::uuid[])
    UNION
    SELECT attendance.youth_id AS id
    FROM attendance_records attendance
    INNER JOIN cohort_sessions session ON session.id = attendance.session_id
    WHERE session.cohort_id = ANY(${sql.array([...cohortIds])}::uuid[])
    ORDER BY id
  `;
  return rows.map(row => row.id);
}
