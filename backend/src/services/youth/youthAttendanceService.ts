import { lockAssignmentProgram } from '../programming/programCycles/assignmentService';
import { getYouthRows } from './youthRowQuery';
import { getSessionRows, type SessionRow } from '../programming/sessions/sessionRowQuery';
import { buildSessionFilters } from '../programming/sessions/sessionRowFilters';
import { getProgramCycleRowsByKeys } from '../programming/programCycles/programCycleRowQuery';
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

  cycle: string;

  program: string;
  enrollmentRequired: boolean;
}

interface YouthAttendanceSession {
  id: string;
  theme: string;
  startsAt: Date;
  endsAt: Date;
  cancelledAt: Date | null;
  sessionType: string;

  status: 'present' | 'absent' | 'late' | 'excused' | null;
  notes: string | null;
}

/**
 * Loads a youth's attendance and notes for a program cycle.
 * @param youthId - Youth whose attendance is needed.
 * @param programId - Program to read.
 * @param cycleId - Cycle to read.
 * @param actor - User whose program access is checked.
 * @example getYouthProgramCycleAttendance(youthId, programId, cycleId, actor)
 */
export async function getYouthProgramCycleAttendance(
  youthId: string,
  programId: string,
  cycleId: string,
  actor: AccessTokenPayload,
) {
  // 1. Check access to the program cycle.
  await assertCanAccessProgramCycle(actor, programId, cycleId);

  // 2. Load attendance and session notes.
  const programCycle = await getYouthProgramCycleContext(youthId, programId, cycleId);
  const [sessions, sessionNotes] = await Promise.all([
    getYouthAttendanceSessions(youthId, programId, cycleId),
    listSessionNotesForYouth(youthId, actor, { programId, cycleId }),
  ]);

  // 3. Include notes with their sessions.
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

/**
 * Saves one youth's attendance across a program cycle.
 * @param youthId - Youth whose attendance changes.
 * @param programId - Program to update.
 * @param cycleId - Cycle to update.
 * @param data - Validated complete session attendance.
 * @param actor - User whose program access is checked.
 * @example setYouthProgramCycleAttendance(youthId, programId, cycleId, data, actor)
 */
export async function setYouthProgramCycleAttendance(
  youthId: string,
  programId: string,
  cycleId: string,
  data: SetYouthProgramCycleAttendanceInput,
  actor: AccessTokenPayload,
) {
  // 1. Check access to the program cycle.
  await assertCanAccessProgramCycle(actor, programId, cycleId);

  const updatedRows = await sql.begin(async tx => {
    const trx = asTransactionSql(tx);

    // 2. Lock the program assignment.
    await lockAssignmentProgram(trx, programId, actor);
    const locked = await trx`
      SELECT assignment.program_id, assignment.cycle_id
      FROM program_cycle_assignments assignment
      WHERE assignment.program_id = ${programId} AND assignment.cycle_id = ${cycleId}
        AND ${programAccessPredicate(actor, sql`assignment.program_id`)}
      FOR UPDATE OF assignment
    `;
    if (!locked.length) throw new NotFoundError('Program cycle not found');

    // 3. Check the submitted sessions and attendance.
    const programCycle = await getYouthProgramCycleContext(youthId, programId, cycleId, trx);
    const sessions = await getYouthAttendanceSessions(youthId, programId, cycleId, true, trx);
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

    // 4. Replace attendance for the submitted sessions.
    if (sessionIds.size) {
      await trx`
        DELETE
        FROM attendance_records
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

    // 5. Return the affected rows.
    const [youth] = await getYouthRows(trx`youth.id = ${youthId}`, trx);
    if (!youth) throw new NotFoundError('Youth profile not found');
    const updatedSessions = actor.permissions.includes('read:sessions')
      ? await trx<SessionRow[]>`
          SELECT session.*
          FROM (${buildSessionFilters(getSessionRows(actor, trx), { ids: [...sessionIds] }, trx)}) session
          ORDER BY session.id
        `
      : undefined;
    const updatedProgramCycle = actor.permissions.includes('read:programs')
      ? (await getProgramCycleRowsByKeys(trx, actor, [{ programId, cycleId }]))[0]
      : undefined;
    return { youth, updatedSessions, updatedProgramCycle };
  });

  return { ...await getYouthProgramCycleAttendance(youthId, programId, cycleId, actor), ...updatedRows };
}

/**
 * Requires the youth, program cycle, and applicable enrollment.
 * @param youthId - Youth to check.
 * @param programId - Program to load.
 * @param cycleId - Cycle to load.
 * @param query - Database client; pass trx inside a transaction.
 * @example getYouthProgramCycleContext(youthId, programId, cycleId, trx)
 */
async function getYouthProgramCycleContext(
  youthId: string,
  programId: string,
  cycleId: string,
  query = sql,
) {
  // 1. Require the youth profile.
  const youth = await query`
    SELECT 1
    FROM youth_profiles
    WHERE user_id = ${youthId}
    LIMIT 1
  `;
  if (!youth.length) throw new NotFoundError('Youth profile not found');

  // 2. Load the program cycle and check enrollment.
  const programCycles = await query<YouthProgramCycleContext[]>`
    SELECT
      assignment.program_id,
      assignment.cycle_id,

      cycle.name AS cycle,

      program.name AS program,
      program.enrollment_required
    FROM program_cycle_assignments assignment
    INNER JOIN program_cycles cycle ON cycle.id = assignment.cycle_id
    INNER JOIN programs program ON program.id = assignment.program_id
    WHERE assignment.program_id = ${programId} AND assignment.cycle_id = ${cycleId}
    LIMIT 1
  `;
  if (!programCycles.length) throw new NotFoundError('Program cycle not found');

  const programCycle = programCycles[0];
  if (programCycle.enrollmentRequired) {
    const enrollment = await query`
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

/**
 * Loads eligible sessions and saved attendance for a youth.
 * @param youthId - Youth whose attendance is needed.
 * @param programId - Program to read.
 * @param cycleId - Cycle to read.
 * @param lock - Whether the caller requires session locks.
 * @param query - Database client; pass trx when locking.
 * @example getYouthAttendanceSessions(youthId, programId, cycleId, true, trx)
 */
function getYouthAttendanceSessions(
  youthId: string,
  programId: string,
  cycleId: string,
  lock = false,
  query = sql,
) {
  return query<YouthAttendanceSession[]>`
    SELECT
      session.id,
      session.theme,
      session.starts_at,
      session.ends_at,
      session.cancelled_at,
      session.session_type,

      attendance.status,
      attendance.notes
    FROM program_sessions session
    INNER JOIN programs program ON program.id = session.program_id
    LEFT JOIN attendance_records attendance
      ON attendance.session_id = session.id
      AND attendance.youth_id = ${youthId}
    WHERE session.program_id = ${programId} AND session.cycle_id = ${cycleId}
      AND (
        program.enrollment_required = FALSE
        OR attendance.id IS NOT NULL
        OR EXISTS (
          SELECT 1
          FROM program_enrollments enrollment
          WHERE enrollment.program_id = session.program_id AND enrollment.cycle_id = session.cycle_id
            AND enrollment.youth_id = ${youthId}
            AND enrollment.enrolled_on <= (session.starts_at AT TIME ZONE 'America/Toronto')::date
            AND (
              enrollment.withdrawn_on IS NULL
              OR enrollment.withdrawn_on > (session.starts_at AT TIME ZONE 'America/Toronto')::date
            )
        )
      )
    ORDER BY session.starts_at DESC, session.id DESC
    ${lock ? query`FOR UPDATE OF session` : query``}
  `;
}
