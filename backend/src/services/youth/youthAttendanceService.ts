import { asTransactionSql, sql } from '../../db/client';
import { ConflictError, NotFoundError } from '../../errors';
import { assertCanAccessCohort } from '../../policies/programAccessPolicy';
import type { AccessTokenPayload } from '../../types/auth';
import type { SetYouthCohortAttendanceInput } from '../../validation/youthSchemas';
import { listSessionNotesForYouth } from '../programming/sessions/sessionNoteService';

interface YouthCohortContext {
  id: string;
  name: string;
  programName: string;
  rosterMode: 'enrolled' | 'open';
}

interface YouthAttendanceSession {
  id: string;
  sessionTypeName: string;
  theme: string;
  startsAt: Date;
  endsAt: Date;
  cancelledAt: Date | null;
  status: 'present' | 'absent' | 'late' | 'excused' | null;
  notes: string | null;
}

export async function getYouthCohortAttendance(
  youthId: string,
  cohortId: string,
  actor: AccessTokenPayload,
) {
  await assertCanAccessCohort(actor, cohortId);
  const cohort = await getYouthCohortContext(sql, youthId, cohortId);
  const [sessions, sessionNotes] = await Promise.all([
    getYouthAttendanceSessions(sql, youthId, cohortId),
    listSessionNotesForYouth(youthId, actor, cohortId),
  ]);
  const notesBySession = new Map<string, Array<(typeof sessionNotes)[number]>>();
  for (const note of sessionNotes) {
    const sessionId = note.sessionId as string;
    notesBySession.set(sessionId, [...(notesBySession.get(sessionId) ?? []), note]);
  }
  return {
    cohort,
    sessions: sessions.map(session => ({
      ...session,
      sessionNotes: notesBySession.get(session.id) ?? [],
    })),
  };
}

export async function setYouthCohortAttendance(
  youthId: string,
  cohortId: string,
  data: SetYouthCohortAttendanceInput,
  actor: AccessTokenPayload,
) {
  await assertCanAccessCohort(actor, cohortId);

  await sql.begin(async tx => {
    const trx = asTransactionSql(tx);
    const cohort = await getYouthCohortContext(trx, youthId, cohortId);
    const sessions = await getYouthAttendanceSessions(trx, youthId, cohortId);
    const sessionIds = new Set(sessions.map(session => session.id));

    if (
      data.records.length !== sessionIds.size
      || data.records.some(record => !sessionIds.has(record.sessionId))
    ) {
      throw new ConflictError('Cohort sessions changed while attendance was being edited');
    }
    if (
      cohort.rosterMode === 'open'
      && data.records.some(record => record.status !== null && record.status !== 'present')
    ) {
      throw new ConflictError('Open sessions only record whether a youth attended');
    }

    if (sessionIds.size) {
      await trx`
        DELETE FROM attendance_records
        WHERE youth_id = ${youthId}
          AND session_id = ANY(${sql.array([...sessionIds])}::uuid[])
      `;
    }

    for (const record of data.records) {
      if (!record.status) continue;
      await trx`
        INSERT INTO attendance_records (
          session_id, youth_id, status, notes, marked_at, marked_by
        )
        VALUES (
          ${record.sessionId},
          ${youthId},
          ${record.status},
          ${record.notes ?? null},
          NOW(),
          ${actor.userId}
        )
      `;
    }
  });

  return getYouthCohortAttendance(youthId, cohortId, actor);
}

async function getYouthCohortContext(
  database: typeof sql,
  youthId: string,
  cohortId: string,
) {
  const youth = await database`SELECT 1 FROM youth_profiles WHERE user_id = ${youthId} LIMIT 1`;
  if (!youth.length) throw new NotFoundError('Youth profile not found');

  const cohorts = await database<YouthCohortContext[]>`
    SELECT pc.id, cycle.name, p.name AS program_name, p.roster_mode
    FROM program_cohorts pc
    INNER JOIN program_cycles cycle ON cycle.id = pc.cycle_id
    INNER JOIN programs p ON p.id = pc.program_id
    WHERE pc.id = ${cohortId}
    LIMIT 1
  `;
  if (!cohorts.length) throw new NotFoundError('Cohort not found');

  const cohort = cohorts[0];
  if (cohort.rosterMode === 'enrolled') {
    const enrollment = await database`
      SELECT 1
      FROM cohort_enrollments
      WHERE cohort_id = ${cohortId}
        AND youth_id = ${youthId}
      LIMIT 1
    `;
    if (!enrollment.length) {
      throw new ConflictError('Youth is not enrolled in this cohort');
    }
  }

  return cohort;
}

function getYouthAttendanceSessions(
  database: typeof sql,
  youthId: string,
  cohortId: string,
) {
  return database<YouthAttendanceSession[]>`
    SELECT
      cs.id,
      st.name AS session_type_name,
      cs.theme,
      cs.starts_at,
      cs.ends_at,
      cs.cancelled_at,
      ar.status,
      ar.notes
    FROM cohort_sessions cs
    INNER JOIN session_types st ON st.id = cs.session_type_id
    INNER JOIN program_cohorts pc ON pc.id = cs.cohort_id
    INNER JOIN programs p ON p.id = pc.program_id
    LEFT JOIN attendance_records ar
      ON ar.session_id = cs.id
      AND ar.youth_id = ${youthId}
    WHERE cs.cohort_id = ${cohortId}
      AND (
        p.roster_mode = 'open'
        OR ar.id IS NOT NULL
        OR EXISTS (
          SELECT 1
          FROM cohort_enrollments ce
          WHERE ce.cohort_id = cs.cohort_id
            AND ce.youth_id = ${youthId}
            AND ce.enrolled_on <= (cs.starts_at AT TIME ZONE 'America/Toronto')::date
            AND (
              ce.withdrawn_on IS NULL
              OR ce.withdrawn_on > (cs.starts_at AT TIME ZONE 'America/Toronto')::date
            )
        )
      )
    ORDER BY cs.starts_at DESC, cs.id DESC
  `;
}
