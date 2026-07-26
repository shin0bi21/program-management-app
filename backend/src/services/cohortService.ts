import { asTransactionSql, sql } from '../db/client';
import { ConflictError, NotFoundError } from '../errors';
import { assertCohortAccess, assertProgramAccess, programAccessPredicate } from '../policies/programAccessPolicy';
import type { AccessTokenPayload } from '../types/auth';
import type { CreateCohortInput, UpdateCohortInput } from '../validation/cohortSchemas';

export function getCohorts(
  actor: AccessTokenPayload,
  programId?: string,
  includeAllPrograms = false,
) {
  return sql`
    SELECT
      pc.id,
      pc.program_id,
      p.name AS program_name,
      p.roster_mode,
      p.min_age,
      p.max_age,
      pc.name,
      pc.starts_on::text AS starts_on,
      pc.ends_on::text AS ends_on,
      COUNT(DISTINCT ce.youth_id) FILTER (
        WHERE ce.enrolled_on <= CURRENT_DATE
          AND (ce.withdrawn_on IS NULL OR ce.withdrawn_on > CURRENT_DATE)
      )::int AS enrolled_count,
      (
        SELECT MIN(cs.starts_at)
        FROM cohort_sessions cs
        WHERE cs.cohort_id = pc.id
          AND cs.starts_at >= NOW()
          AND cs.cancelled_at IS NULL
      ) AS next_session_at,
      (
        SELECT cs.id
        FROM cohort_sessions cs
        WHERE cs.cohort_id = pc.id
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
        FROM cohort_sessions cs
        INNER JOIN attendance_records ar ON ar.session_id = cs.id
        WHERE cs.cohort_id = pc.id
      ) AS average_attendance,
      (
        SELECT COUNT(ar.id)::int
        FROM cohort_sessions cs
        INNER JOIN attendance_records ar ON ar.session_id = cs.id
        WHERE cs.cohort_id = pc.id
          AND ar.status IN ('present', 'late')
      ) AS attendance_attended_count,
      (
        SELECT COUNT(ar.id)::int
        FROM cohort_sessions cs
        INNER JOIN attendance_records ar ON ar.session_id = cs.id
        WHERE cs.cohort_id = pc.id
          AND ar.status != 'excused'
      ) AS attendance_recorded_count,
      (
        SELECT COUNT(DISTINCT ar.youth_id)::int
        FROM cohort_sessions cs
        INNER JOIN attendance_records ar ON ar.session_id = cs.id
        WHERE cs.cohort_id = pc.id
      ) AS unique_attendee_count,
      CASE
        WHEN CURRENT_DATE < pc.starts_on THEN 'upcoming'
        WHEN CURRENT_DATE > pc.ends_on THEN 'completed'
        ELSE 'active'
      END AS state
    FROM program_cohorts pc
    INNER JOIN programs p ON p.id = pc.program_id
    LEFT JOIN cohort_enrollments ce ON ce.cohort_id = pc.id
    WHERE ${programId ? sql`pc.program_id = ${programId}` : sql`TRUE`}
      AND ${includeAllPrograms ? sql`TRUE` : programAccessPredicate(actor, sql`pc.program_id`)}
    GROUP BY pc.id, p.id
    ORDER BY pc.starts_on DESC, pc.name
  `;
}

export async function createCohort(data: CreateCohortInput, actor: AccessTokenPayload) {
  await assertProgramAccess(actor, data.programId);
  const rows = await sql`
    INSERT INTO program_cohorts (
      program_id, name, starts_on, ends_on, created_by, updated_by
    )
    VALUES (
      ${data.programId}, ${data.name}, ${data.startsOn}, ${data.endsOn}, ${actor.userId}, ${actor.userId}
    )
    RETURNING
      id,
      program_id,
      name,
      starts_on::text AS starts_on,
      ends_on::text AS ends_on,
      (SELECT roster_mode FROM programs WHERE id = ${data.programId}) AS roster_mode,
      (SELECT min_age FROM programs WHERE id = ${data.programId}) AS min_age,
      (SELECT max_age FROM programs WHERE id = ${data.programId}) AS max_age
  `;
  return rows[0];
}

export async function updateCohort(id: string, data: UpdateCohortInput, actor: AccessTokenPayload) {
  await assertCohortAccess(actor, id);
  const outside = await sql`
    SELECT 1
    FROM cohort_sessions cs
    WHERE cs.cohort_id = ${id}
      AND (
        (cs.starts_at AT TIME ZONE 'America/Toronto')::date < ${data.startsOn}
        OR (cs.ends_at AT TIME ZONE 'America/Toronto')::date > ${data.endsOn}
      )
    LIMIT 1
  `;
  if (outside.length) throw new ConflictError('Cohort dates must contain all existing sessions');
  const rows = await sql`
    UPDATE program_cohorts
    SET name = ${data.name}, starts_on = ${data.startsOn}, ends_on = ${data.endsOn},
        updated_at = NOW(), updated_by = ${actor.userId}
    WHERE id = ${id}
    RETURNING id
  `;
  if (!rows.length) throw new NotFoundError('Cohort not found');
  return rows[0];
}

export async function deleteCohort(id: string, actor: AccessTokenPayload) {
  await assertCohortAccess(actor, id);
  await sql.begin(async tx => {
    const trx = asTransactionSql(tx);
    const cohorts = await trx`SELECT id FROM program_cohorts WHERE id = ${id} FOR UPDATE`;
    if (!cohorts.length) throw new NotFoundError('Cohort not found');
    const attendance = await trx`
      SELECT 1 FROM attendance_records ar
      INNER JOIN cohort_sessions cs ON cs.id = ar.session_id
      WHERE cs.cohort_id = ${id} LIMIT 1
    `;
    if (attendance.length) {
      throw new ConflictError('Cohort cannot be deleted because one or more sessions have attendance');
    }
    await trx`DELETE FROM cohort_enrollments WHERE cohort_id = ${id}`;
    await trx`DELETE FROM program_cohorts WHERE id = ${id}`;
  });
}
