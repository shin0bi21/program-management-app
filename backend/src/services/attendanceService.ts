import { asTransactionSql, sql } from '../db/client';
import { ConflictError, NotFoundError } from '../errors';
import type { SaveAttendanceInput } from '../validation/cohortSchemas';

export async function getSessionRoster(sessionId: string) {
  const sessions = await sql<{ rosterMode: 'enrolled' | 'open' }[]>`
    SELECT p.roster_mode
    FROM cohort_sessions cs
    INNER JOIN program_cohorts pc ON pc.id = cs.cohort_id
    INNER JOIN programs p ON p.id = pc.program_id
    WHERE cs.id = ${sessionId}
  `;
  if (!sessions.length) throw new NotFoundError('Session not found');

  if (sessions[0].rosterMode === 'open') {
    return sql`
      SELECT
        u.id AS youth_id,
        u.first_name,
        u.last_name,
        ar.status,
        ar.notes
      FROM attendance_records ar
      INNER JOIN users u ON u.id = ar.youth_id
      WHERE ar.session_id = ${sessionId}
      ORDER BY u.first_name, u.last_name
    `;
  }

  return sql`
      SELECT
        u.id AS youth_id,
        u.first_name,
        u.last_name,
        ar.status,
        ar.notes
      FROM cohort_sessions cs
      INNER JOIN cohort_enrollments ce ON ce.cohort_id = cs.cohort_id
      INNER JOIN users u ON u.id = ce.youth_id
      LEFT JOIN attendance_records ar
        ON ar.session_id = cs.id
        AND ar.youth_id = ce.youth_id
      WHERE cs.id = ${sessionId}
        AND ce.enrolled_on <= (cs.starts_at AT TIME ZONE 'America/Toronto')::date
        AND (
          ce.withdrawn_on IS NULL
          OR ce.withdrawn_on > (cs.starts_at AT TIME ZONE 'America/Toronto')::date
        )
      ORDER BY u.first_name, u.last_name
    `;
}

export async function saveAttendance(sessionId: string, data: SaveAttendanceInput, actorId: string) {
  await sql.begin(async tx => {
    const trx = asTransactionSql(tx);
    const sessions = await trx<{ id: string; rosterMode: 'enrolled' | 'open' }[]>`
      SELECT cs.id, p.roster_mode
      FROM cohort_sessions cs
      INNER JOIN program_cohorts pc ON pc.id = cs.cohort_id
      INNER JOIN programs p ON p.id = pc.program_id
      WHERE cs.id = ${sessionId}
    `;
    if (!sessions.length) throw new NotFoundError('Session not found');

    const submittedIds = data.records.map(record => record.youthId);

    if (sessions[0].rosterMode === 'open') {
      if (data.records.some(record => record.status !== 'present')) {
        throw new ConflictError('Open sessions only record whether a youth attended');
      }

      const profiles = submittedIds.length
        ? await trx<{ id: string }[]>`
            SELECT user_id AS id
            FROM youth_profiles
            WHERE user_id = ANY(${sql.array(submittedIds)}::uuid[])
          `
        : [];
      if (profiles.length !== submittedIds.length) {
        throw new NotFoundError('One or more youth profiles were not found');
      }

      await trx`
        DELETE FROM attendance_records
        WHERE session_id = ${sessionId}
          AND NOT (youth_id = ANY(${sql.array(submittedIds)}::uuid[]))
      `;
    } else {
      const eligibleYouth = await trx<{ youthId: string }[]>`
        SELECT ce.youth_id
        FROM cohort_sessions cs
        INNER JOIN cohort_enrollments ce ON ce.cohort_id = cs.cohort_id
        WHERE cs.id = ${sessionId}
          AND ce.enrolled_on <= (cs.starts_at AT TIME ZONE 'America/Toronto')::date
          AND (
            ce.withdrawn_on IS NULL
            OR ce.withdrawn_on > (cs.starts_at AT TIME ZONE 'America/Toronto')::date
          )
      `;
      const eligibleIds = new Set(eligibleYouth.map(youth => youth.youthId));

      for (const record of data.records) {
        if (!eligibleIds.has(record.youthId)) {
          throw new ConflictError('Attendance can only be recorded for youth enrolled in the session cohort');
        }
      }

      await trx`
        DELETE FROM attendance_records
        WHERE session_id = ${sessionId}
          AND youth_id = ANY(${sql.array([...eligibleIds])}::uuid[])
          AND NOT (youth_id = ANY(${sql.array(submittedIds)}::uuid[]))
      `;
    }

    for (const record of data.records) {
      await trx`
        INSERT INTO attendance_records (
          session_id, youth_id, status, notes, marked_at, marked_by
        )
        VALUES (
          ${sessionId}, ${record.youthId}, ${record.status}, ${record.notes ?? null}, NOW(), ${actorId}
        )
        ON CONFLICT (session_id, youth_id) DO UPDATE SET
          status = EXCLUDED.status,
          notes = EXCLUDED.notes,
          marked_at = NOW(),
          marked_by = EXCLUDED.marked_by,
          updated_at = NOW()
      `;
    }
  });

  return getSessionRoster(sessionId);
}
