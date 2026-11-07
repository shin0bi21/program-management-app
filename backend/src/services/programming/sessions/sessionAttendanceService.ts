import { getYouthRowsByIds } from '../../youth/youthRecordQuery';
import { getProgramCycleRowsByKeys } from '../programCycles/programCycleRecordQuery';
import { asTransactionSql, sql } from '../../../db/client';
import { ConflictError, NotFoundError, InternalServerError } from '../../../errors';
import { assertCanAccessSession, programAccessPredicate } from '../../../policies/programAccessPolicy';
import { getSessionRows } from './sessionRowQuery';
import { filterSessionRows } from './sessionRowFilters';
import type { AccessTokenPayload } from '../../../types/auth';
import type { SetAttendanceInput } from '../../../validation/programmingSchemas';

/**
 * Loads eligible and previously recorded attendees within the actor's session scope.
 * @param sessionId - Session whose roster is needed.
 * @param actor - Actor whose program access is enforced; callers enforce route permissions.
 * @example getSessionRoster(sessionId, actor) // includes saved attendees after a date move
 */
export async function getSessionRoster(sessionId: string, actor: AccessTokenPayload) {
  await assertCanAccessSession(actor, sessionId);
  return readSessionRoster(sessionId);
}

/**
 * Reads current enrollment eligibility together with preserved attendance history.
 * @param sessionId - Authorized session; a missing session raises 404.
 * @param query - Defaults to the shared client; pass trx to read inside the current write.
 * @example readSessionRoster(sessionId, trx) // includes recorded youth outside the current enrollment window
 */
async function readSessionRoster(sessionId: string, query = sql) {
  const sessions = await query<{ enrollmentRequired: boolean }[]>`
    SELECT p.enrollment_required
    FROM program_sessions cs
    INNER JOIN programs p ON p.id = cs.program_id
    WHERE cs.id = ${sessionId}
  `;
  if (!sessions.length) throw new NotFoundError('Session not found');

  if (!sessions[0].enrollmentRequired) {
    return query`
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

  return query`
      SELECT
        u.id AS youth_id,
        u.first_name,
        u.last_name,
        ar.status,
        ar.notes
      FROM program_sessions cs
      INNER JOIN LATERAL (
        SELECT enrollment.youth_id
        FROM program_enrollments enrollment
        WHERE enrollment.program_id = cs.program_id AND enrollment.cycle_id = cs.cycle_id
          AND enrollment.enrolled_on <= (cs.starts_at AT TIME ZONE 'America/Toronto')::date
          AND (
            enrollment.withdrawn_on IS NULL
            OR enrollment.withdrawn_on > (cs.starts_at AT TIME ZONE 'America/Toronto')::date
          )
        UNION
        SELECT recorded.youth_id FROM attendance_records recorded WHERE recorded.session_id = cs.id
      ) roster ON TRUE
      INNER JOIN users u ON u.id = roster.youth_id
      LEFT JOIN attendance_records ar
        ON ar.session_id = cs.id
        AND ar.youth_id = roster.youth_id
      WHERE cs.id = ${sessionId}
      ORDER BY u.first_name, u.last_name
    `;
}

export async function setSessionAttendance(
  sessionId: string,
  data: SetAttendanceInput,
  actor: AccessTokenPayload,
) {
  await assertCanAccessSession(actor, sessionId);
  return sql.begin(async tx => {
    const trx = asTransactionSql(tx);
    const sessions = await trx<{ id: string; programId: string; cycleId: string; enrollmentRequired: boolean }[]>`
      SELECT cs.id, cs.program_id, cs.cycle_id, p.enrollment_required
      FROM program_sessions cs
      INNER JOIN programs p ON p.id = cs.program_id
      WHERE cs.id = ${sessionId}
        AND ${programAccessPredicate(actor, sql`cs.program_id`)}
      FOR UPDATE OF cs
    `;
    if (!sessions.length) throw new NotFoundError('Session not found');

    const submittedIds = data.records.map(record => record.youthId);
    const previousAttendance = await trx<{ youthId: string }[]>`
      SELECT youth_id FROM attendance_records WHERE session_id = ${sessionId}
    `;
    const affectedYouthIds = [...new Set([...submittedIds, ...previousAttendance.map(record => record.youthId)])];

    if (!sessions[0].enrollmentRequired) {
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
      // Use the same eligible-or-recorded membership shown by the roster editor.
      const eligibleYouth = await readSessionRoster(sessionId, trx);
      const eligibleIds = new Set(eligibleYouth.map(youth => youth.youthId));

      for (const record of data.records) {
        if (!eligibleIds.has(record.youthId)) {
          throw new ConflictError('Attendance can only be recorded for youth enrolled in the session program and cycle');
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
          ${sessionId}, ${record.youthId}, ${record.status}, ${record.notes ?? null}, NOW(), ${actor.userId}
        )
        ON CONFLICT (session_id, youth_id) DO UPDATE SET
          status = EXCLUDED.status,
          notes = EXCLUDED.notes,
          marked_at = NOW(),
          marked_by = EXCLUDED.marked_by,
          updated_at = NOW()
      `;
    }

    const [session] = await filterSessionRows(getSessionRows(actor, trx), { ids: [sessionId] }, trx);
    if (!session) throw new InternalServerError('Saved attendance session is unavailable');
    const roster = await readSessionRoster(sessionId, trx);
    const updatedYouth = actor.permissions.includes('read:youth_profiles')
      ? await getYouthRowsByIds(trx, affectedYouthIds)
      : undefined;
    const updatedProgramCycle = actor.permissions.includes('read:programs')
      ? (await getProgramCycleRowsByKeys(trx, actor, [sessions[0]]))[0]
      : undefined;
    return { roster, session, updatedYouth, updatedProgramCycle };
  });
}
