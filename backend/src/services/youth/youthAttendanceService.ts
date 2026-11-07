import { lockAssignmentProgram } from '../programming/programCycles/assignmentService';
import { getYouthRowsByIds } from './youthRowQuery';
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
  cycleName: string;
  programName: string;
  enrollmentRequired: boolean;
}

interface YouthAttendanceSession {
  id: string;
  sessionType: string;
  theme: string;
  startsAt: Date;
  endsAt: Date;
  cancelledAt: Date | null;
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
      SELECT pc.program_id, pc.cycle_id
      FROM program_cycle_assignments pc
      WHERE pc.program_id = ${programId} AND pc.cycle_id = ${cycleId}
        AND ${programAccessPredicate(actor, sql`pc.program_id`)}
      FOR UPDATE OF pc
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
    const [youth] = await getYouthRowsByIds(trx, [youthId]);
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
      cs.id,
      cs.theme,
      cs.starts_at,
      cs.ends_at,
      cs.cancelled_at,
      cs.session_type,

      ar.status,
      ar.notes
    FROM program_sessions cs
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
    ${lock ? query`FOR UPDATE OF cs` : query``}
  `;
}
