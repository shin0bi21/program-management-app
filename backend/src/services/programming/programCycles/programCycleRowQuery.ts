import { sql } from '../../../db/client';
import { programAccessPredicate } from '../../../policies/programAccessPolicy';
import type { AccessTokenPayload } from '../../../types/auth';

export interface ProgramCycleRow {
  programId: string;
  programName: string;
  enrollmentRequired: boolean;
  minAge: number | null;
  maxAge: number | null;
  cycleId: string;
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

export const programCycleState = sql`
  CASE
    WHEN CURRENT_DATE < cycle.starts_on THEN 'upcoming'
    WHEN CURRENT_DATE > cycle.ends_on THEN 'completed'
    ELSE 'active'
  END
`;

export const programCycleRowColumns = sql`
  pc.program_id,
  p.name AS program_name,
  p.enrollment_required,
  p.min_age,
  p.max_age,
  cycle.id AS cycle_id,
  cycle.name AS cycle_name,
  cycle.starts_on::text AS starts_on,
  cycle.ends_on::text AS ends_on,
  (
    SELECT COUNT(DISTINCT ce.youth_id)::int
    FROM program_enrollments ce
    WHERE ce.program_id = pc.program_id AND ce.cycle_id = pc.cycle_id AND ce.enrolled_on <= CURRENT_DATE
      AND (ce.withdrawn_on IS NULL OR ce.withdrawn_on > CURRENT_DATE)
  ) AS enrolled_count,
  (
    SELECT MIN(cs.starts_at)
    FROM program_sessions cs
    WHERE cs.program_id = pc.program_id AND cs.cycle_id = pc.cycle_id AND cs.starts_at >= NOW() AND cs.cancelled_at IS NULL
  ) AS next_session_at,
  (
    SELECT cs.id
    FROM program_sessions cs
    WHERE cs.program_id = pc.program_id AND cs.cycle_id = pc.cycle_id AND cs.starts_at >= NOW() AND cs.cancelled_at IS NULL
    ORDER BY cs.starts_at
    LIMIT 1
  ) AS next_session_id,
  (
    SELECT ROUND(
      100.0 * COUNT(ar.id) FILTER (WHERE ar.status IN ('present', 'late'))
      / NULLIF(COUNT(ar.id) FILTER (WHERE ar.status != 'excused'), 0), 1
    )::float
    FROM program_sessions cs
    INNER JOIN attendance_records ar ON ar.session_id = cs.id
    WHERE cs.program_id = pc.program_id AND cs.cycle_id = pc.cycle_id
  ) AS average_attendance,
  (
    SELECT COUNT(ar.id)::int
    FROM program_sessions cs
    INNER JOIN attendance_records ar ON ar.session_id = cs.id
    WHERE cs.program_id = pc.program_id AND cs.cycle_id = pc.cycle_id AND ar.status IN ('present', 'late')
  ) AS attendance_attended_count,
  (
    SELECT COUNT(ar.id)::int
    FROM program_sessions cs
    INNER JOIN attendance_records ar ON ar.session_id = cs.id
    WHERE cs.program_id = pc.program_id AND cs.cycle_id = pc.cycle_id AND ar.status != 'excused'
  ) AS attendance_recorded_count,
  (
    SELECT COUNT(DISTINCT ar.youth_id)::int
    FROM program_sessions cs
    INNER JOIN attendance_records ar ON ar.session_id = cs.id
    WHERE cs.program_id = pc.program_id AND cs.cycle_id = pc.cycle_id AND ar.status IN ('present', 'late')
  ) AS unique_attendee_count,
  ${programCycleState} AS state
`;

export const programCycleRowFrom = sql`
  FROM program_cycle_assignments pc
  INNER JOIN programs p ON p.id = pc.program_id
  INNER JOIN program_cycles cycle ON cycle.id = pc.cycle_id
`;

export interface ProgramCycleKey {
  programId: string;
  cycleId: string;
}

/**
 * Builds rows for table and calendar items.
 * @param appliedFilters - SQL filters supplied by the service.
 * @param query - Database client; pass trx inside a transaction.
 * @example getProgramCycleRows(appliedFilters, trx)
 */
export function getProgramCycleRows(appliedFilters = sql`TRUE`, query = sql) {
  return query<ProgramCycleRow[]>`
    SELECT ${programCycleRowColumns}
    ${programCycleRowFrom}
    WHERE ${appliedFilters}
  `;
}

/**
 * Matches the selected program-cycle pairs.
 * @param keys - Program and cycle IDs to match.
 * @example programCycleKeysPredicate([]) // matches no rows
 */
export function programCycleKeysPredicate(keys: readonly ProgramCycleKey[]) {
  if (!keys.length) return sql`FALSE`;

  return sql`(pc.program_id, pc.cycle_id) IN (
    SELECT *
    FROM UNNEST(${sql.array(keys.map(key => key.programId))}::uuid[], ${sql.array(keys.map(key => key.cycleId))}::uuid[])
  )`;
}

/**
 * Loads accessible rows for selected program-cycle pairs.
 * @param database - Database client for the read.
 * @param actor - User requesting the rows.
 * @param keys - Program and cycle IDs to load.
 * @example getProgramCycleRowsByKeys(trx, actor, keys)
 */
export function getProgramCycleRowsByKeys(database: typeof sql, actor: AccessTokenPayload, keys: readonly ProgramCycleKey[]) {
  if (!keys.length) return Promise.resolve([] as ProgramCycleRow[]);

  return database<ProgramCycleRow[]>`
    ${getProgramCycleRows(database`
      ${programCycleKeysPredicate(keys)}
      AND ${programAccessPredicate(actor, database`pc.program_id`)}
    `, database)}
    ORDER BY pc.program_id, pc.cycle_id
  `;
}

/**
 * Finds youth linked to the selected program-cycle pairs.
 * @param database - Database client for the read.
 * @param keys - Program and cycle IDs to match.
 * @example getProgramCycleYouthIds(trx, keys)
 */
export async function getProgramCycleYouthIds(database: typeof sql, keys: readonly ProgramCycleKey[]) {
  if (!keys.length) return [];

  const rows = await database<{ id: string }[]>`
    SELECT youth_id AS id
    FROM program_enrollments pc
    WHERE ${programCycleKeysPredicate(keys)}
    UNION
    SELECT attendance.youth_id AS id
    FROM attendance_records attendance
    INNER JOIN program_sessions pc ON pc.id = attendance.session_id
    WHERE ${programCycleKeysPredicate(keys)}
    ORDER BY id
  `;
  return rows.map(row => row.id);
}
