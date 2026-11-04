import { lockAssignmentProgram } from '../programming/programCycles/assignmentService';
import { getYouthRowsByIds } from './youthRecordQuery';
import { getSessionRowsByIds } from '../programming/sessions/sessionRecordQuery';
import { getProgramCycleRowsByKeys } from '../programming/programCycles/programCycleRecordQuery';
import { programAccessPredicate } from '../../policies/programAccessPolicy';
import { asTransactionSql, sql } from '../../db/client';
import { ConflictError, NotFoundError } from '../../errors';
import { assertCanAccessProgramCycle } from '../../policies/programAccessPolicy';
import type { AccessTokenPayload } from '../../types/auth';
import type { SetYouthProgramCycleAttendanceInput } from '../../validation/youthSchemas';
import { listSessionNotesForYouth } from '../programming/sessions/sessionNoteService';

interface YouthProgramCycleContext {
  programId: string;
  cycleId: string;
  cycleName: string;
  programName: string;
  enrollmentRequired: boolean;
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

export async function getYouthProgramCycleAttendance(
  youthId: string,
  programId: string,
  cycleId: string,
  actor: AccessTokenPayload,
) {
  await assertCanAccessProgramCycle(actor, programId, cycleId);
  const programCycle = await getYouthProgramCycleContext(sql, youthId, programId, cycleId);
  const [sessions, sessionNotes] = await Promise.all([
    getYouthAttendanceSessions(sql, youthId, programId, cycleId),
    listSessionNotesForYouth(youthId, actor, { programId, cycleId }),
  ]);
  const notesBySession = new Map<string, Array<(typeof sessionNotes)[number]>>();
  for (const note of sessionNotes) {
    const sessionId = note.sessionId as string;
    notesBySession.set(sessionId, [...(notesBySession.get(sessionId) ?? []), note]);
  }
  return {
    programCycle,
    sessions: sessions.map(session => ({
      ...session,
      sessionNotes: notesBySession.get(session.id) ?? [],
    })),
  };
}

export async function setYouthProgramCycleAttendance(
  youthId: string,
  programId: string,
  cycleId: string,
  data: SetYouthProgramCycleAttendanceInput,
  actor: AccessTokenPayload,
) {
  await assertCanAccessProgramCycle(actor, programId, cycleId);

  const updatedRows = await sql.begin(async tx => {
    const trx = asTransactionSql(tx);
    // Match assignment changes and session moves: lock the program before the pair and sessions.
    await lockAssignmentProgram(trx, programId, actor);
    const locked = await trx`
      SELECT pc.program_id, pc.cycle_id FROM program_cycle_assignments pc
      WHERE pc.program_id = ${programId} AND pc.cycle_id = ${cycleId}
        AND ${programAccessPredicate(actor, sql`pc.program_id`)}
      FOR UPDATE OF pc
    `;
    if (!locked.length) throw new NotFoundError('Program cycle not found');

    const programCycle = await getYouthProgramCycleContext(trx, youthId, programId, cycleId);
    const sessions = await getYouthAttendanceSessions(trx, youthId, programId, cycleId, true);
    const sessionIds = new Set(sessions.map(session => session.id));

    if (
      data.records.length !== sessionIds.size
      || data.records.some(record => !sessionIds.has(record.sessionId))
    ) {
      throw new ConflictError('Program cycle sessions changed while attendance was being edited');
    }
    if (
      !programCycle.enrollmentRequired
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
    const [youth] = await getYouthRowsByIds(trx, [youthId]);
    if (!youth) throw new NotFoundError('Youth profile not found');
    const updatedSessions = actor.permissions.includes('read:sessions')
      ? await getSessionRowsByIds(trx, actor, [...sessionIds])
      : undefined;
    const updatedProgramCycle = actor.permissions.includes('read:programs')
      ? (await getProgramCycleRowsByKeys(trx, actor, [{ programId, cycleId }]))[0]
      : undefined;
    return { youth, updatedSessions, updatedProgramCycle };
  });

  return { ...await getYouthProgramCycleAttendance(youthId, programId, cycleId, actor), ...updatedRows };
}

async function getYouthProgramCycleContext(
  database: typeof sql,
  youthId: string,
  programId: string,
  cycleId: string,
) {
  const youth = await database`SELECT 1 FROM youth_profiles WHERE user_id = ${youthId} LIMIT 1`;
  if (!youth.length) throw new NotFoundError('Youth profile not found');

  const programCycles = await database<YouthProgramCycleContext[]>`
    SELECT pc.program_id, pc.cycle_id, cycle.name AS cycle_name, p.name AS program_name, p.enrollment_required
    FROM program_cycle_assignments pc
    INNER JOIN program_cycles cycle ON cycle.id = pc.cycle_id
    INNER JOIN programs p ON p.id = pc.program_id
    WHERE pc.program_id = ${programId} AND pc.cycle_id = ${cycleId}
    LIMIT 1
  `;
  if (!programCycles.length) throw new NotFoundError('Program cycle not found');

  const programCycle = programCycles[0];
  if (programCycle.enrollmentRequired) {
    const enrollment = await database`
      SELECT 1
      FROM program_enrollments
      WHERE program_id = ${programId} AND cycle_id = ${cycleId}
        AND youth_id = ${youthId}
      LIMIT 1
    `;
    if (!enrollment.length) {
      throw new ConflictError('Youth is not enrolled in this program cycle');
    }
  }

  return programCycle;
}

function getYouthAttendanceSessions(
  database: typeof sql,
  youthId: string,
  programId: string,
  cycleId: string,
  lock = false,
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
    FROM program_sessions cs
    INNER JOIN session_types st ON st.id = cs.session_type_id
    INNER JOIN programs p ON p.id = cs.program_id
    LEFT JOIN attendance_records ar
      ON ar.session_id = cs.id
      AND ar.youth_id = ${youthId}
    WHERE cs.program_id = ${programId} AND cs.cycle_id = ${cycleId}
      AND (
        p.enrollment_required = FALSE
        OR ar.id IS NOT NULL
        OR EXISTS (
          SELECT 1
          FROM program_enrollments ce
          WHERE ce.program_id = cs.program_id AND ce.cycle_id = cs.cycle_id
            AND ce.youth_id = ${youthId}
            AND ce.enrolled_on <= (cs.starts_at AT TIME ZONE 'America/Toronto')::date
            AND (
              ce.withdrawn_on IS NULL
              OR ce.withdrawn_on > (cs.starts_at AT TIME ZONE 'America/Toronto')::date
            )
        )
      )
    ORDER BY cs.starts_at DESC, cs.id DESC
    ${lock ? sql`FOR UPDATE OF cs` : sql``}
  `;
}
