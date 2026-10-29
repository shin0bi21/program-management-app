import { sql } from '../../../db/client';
import { programAccessPredicate } from '../../../policies/programAccessPolicy';
import type { AccessTokenPayload } from '../../../types/auth';

export interface SessionRow {
  id: string;
  cohortId: string;
  cycleId: string;
  sessionTypeId: string;
  sessionTypeName: string;
  theme: string;
  cohortName: string;
  programId: string;
  programName: string;
  enrollmentRequired: boolean;
  startsAt: Date;
  endsAt: Date;
  cancelledAt: Date | null;
  description: string | null;
  attendanceMarkedCount: number;
  attendedCount: number;
  attendanceRate: number | null;
  state: 'upcoming' | 'completed' | 'cancelled';
}

export const sessionState = sql`CASE WHEN cs.cancelled_at IS NOT NULL THEN 'cancelled' WHEN cs.ends_at < NOW() THEN 'completed' ELSE 'upcoming' END`;

export const sessionRowColumns = sql`
  cs.id, cs.cohort_id, pc.cycle_id, cs.session_type_id, st.name AS session_type_name, cs.theme,
  cycle.name AS cohort_name, p.id AS program_id, p.name AS program_name, p.enrollment_required,
  cs.starts_at, cs.ends_at, cs.cancelled_at, cs.description,
  COUNT(ar.id)::int AS attendance_marked_count,
  COUNT(ar.id) FILTER (WHERE ar.status IN ('present', 'late'))::int AS attended_count,
  ROUND(
    100.0 * COUNT(ar.id) FILTER (WHERE ar.status IN ('present', 'late'))
    / NULLIF(COUNT(ar.id) FILTER (WHERE ar.status != 'excused'), 0), 1
  )::float AS attendance_rate,
  ${sessionState} AS state
`;

export const sessionRowJoins = sql`
  FROM cohort_sessions cs
  INNER JOIN session_types st ON st.id = cs.session_type_id
  INNER JOIN program_cohorts pc ON pc.id = cs.cohort_id
  INNER JOIN program_cycles cycle ON cycle.id = pc.cycle_id
  INNER JOIN programs p ON p.id = pc.program_id
  LEFT JOIN attendance_records ar ON ar.session_id = cs.id
`;

export function getSessionRowsByIds(database: typeof sql, actor: AccessTokenPayload, ids: readonly string[]) {
  if (!ids.length) return Promise.resolve<SessionRow[]>([]);

  return database<SessionRow[]>`
    SELECT ${sessionRowColumns}
    ${sessionRowJoins}
    WHERE cs.id = ANY(${database.array([...ids])}::uuid[])
      AND ${programAccessPredicate(actor, sql`pc.program_id`)}
    GROUP BY cs.id, pc.id, p.id, cycle.id, st.id
    ORDER BY cs.id
  `;
}
