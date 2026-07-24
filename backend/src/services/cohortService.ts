import { sql } from '../db/client';
import type { CreateCohortInput } from '../validation/cohortSchemas';

export function getCohorts(programId?: string) {
  return sql`
    SELECT
      pc.id,
      pc.program_id,
      p.name AS program_name,
      pc.name,
      pc.starts_on::text AS starts_on,
      pc.ends_on::text AS ends_on,
      COUNT(DISTINCT ce.youth_id) FILTER (
        WHERE ce.enrolled_on <= CURRENT_DATE
          AND (ce.withdrawn_on IS NULL OR ce.withdrawn_on > CURRENT_DATE)
      )::int AS enrolled_count,
      (
        SELECT MIN(cs.starts_at)
        FROM cohort_activities ca
        INNER JOIN cohort_sessions cs ON cs.activity_id = ca.id
        WHERE ca.cohort_id = pc.id
          AND cs.starts_at >= NOW()
          AND cs.cancelled_at IS NULL
      ) AS next_session_at,
      (
        SELECT cs.id
        FROM cohort_activities ca
        INNER JOIN cohort_sessions cs ON cs.activity_id = ca.id
        WHERE ca.cohort_id = pc.id
          AND cs.starts_at >= NOW()
          AND cs.cancelled_at IS NULL
        ORDER BY cs.starts_at
        LIMIT 1
      ) AS next_session_id,
      (
        SELECT ROUND(
          100.0 * COUNT(ar.id) FILTER (WHERE ar.status IN ('present', 'late'))
          / NULLIF(COUNT(ar.id) FILTER (WHERE ar.status != 'excused'), 0),
          1
        )::float
        FROM cohort_activities ca
        INNER JOIN cohort_sessions cs ON cs.activity_id = ca.id
        INNER JOIN attendance_records ar ON ar.session_id = cs.id
        WHERE ca.cohort_id = pc.id
      ) AS average_attendance,
      (
        SELECT COUNT(ar.id)::int
        FROM cohort_activities ca
        INNER JOIN cohort_sessions cs ON cs.activity_id = ca.id
        INNER JOIN attendance_records ar ON ar.session_id = cs.id
        WHERE ca.cohort_id = pc.id
          AND ar.status IN ('present', 'late')
      ) AS attendance_attended_count,
      (
        SELECT COUNT(ar.id)::int
        FROM cohort_activities ca
        INNER JOIN cohort_sessions cs ON cs.activity_id = ca.id
        INNER JOIN attendance_records ar ON ar.session_id = cs.id
        WHERE ca.cohort_id = pc.id
          AND ar.status != 'excused'
      ) AS attendance_recorded_count,
      CASE
        WHEN CURRENT_DATE < pc.starts_on THEN 'upcoming'
        WHEN CURRENT_DATE > pc.ends_on THEN 'completed'
        ELSE 'active'
      END AS state
    FROM program_cohorts pc
    INNER JOIN programs p ON p.id = pc.program_id
    LEFT JOIN cohort_enrollments ce ON ce.cohort_id = pc.id
    WHERE ${programId ? sql`pc.program_id = ${programId}` : sql`TRUE`}
    GROUP BY pc.id, p.id
    ORDER BY pc.starts_on DESC, pc.name
  `;
}

export async function createCohort(data: CreateCohortInput, actorId: string) {
  const rows = await sql`
    INSERT INTO program_cohorts (
      program_id, name, starts_on, ends_on, created_by, updated_by
    )
    VALUES (
      ${data.programId}, ${data.name}, ${data.startsOn}, ${data.endsOn}, ${actorId}, ${actorId}
    )
    RETURNING id, program_id, name, starts_on::text AS starts_on, ends_on::text AS ends_on
  `;
  return rows[0];
}
