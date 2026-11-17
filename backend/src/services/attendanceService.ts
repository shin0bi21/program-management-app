import { lockAssignmentProgram } from './programming/programCycles/assignmentService';
import { getYouthRows } from './youth/youthRowQuery';
import { getSessionRows, type SessionRow } from './programming/sessions/sessionRowQuery';
import { buildSessionFilters } from './programming/sessions/sessionRowFilters';
import { getProgramCycleRowsByKeys } from './programming/programCycles/programCycleRowQuery';
import { asTransactionSql, sql } from '../db/client';
import { ConflictError, NotFoundError } from '../errors';
import { assertProgramAccess, assertProgramCycleAccess, programAccessPredicate } from '../policies/programAccessPolicy';
import type { AccessTokenPayload } from '../types/auth';
import type { AttendanceReportInput } from '../validation/programmingSchemas';
import type { SetAttendanceInput } from '../validation/youthSchemas';

type AttendanceStatus = 'present' | 'late' | 'absent' | 'excused';
type YouthRow = { id: string; firstName: string; lastName: string };
interface AttendanceSessionRow {
  id: string;
  title: string;
  date: string;
  startTime: string;
  completed: boolean;
  cancelledAt: string | null;
  sessionType: string;

  youthId: string;

  status: AttendanceStatus | null;
  notes: string | null;
}
interface SessionNoteRow {
  id: string;
  sessionId: string;
  category: 'general' | 'attendance' | 'behaviour' | 'achievement';
  details: string;
  createdAt: string;
  updatedAt: string;
  createdByName: string | null;
  youth: Array<{ youthId: string; firstName: string; lastName: string }>;
}

export interface AttendanceFilters {
  youthIds?: string[];
  sessionId?: string;
  programId?: string;
  cycleId?: string;
}

export interface AttendanceGroup {
  programCycle: AttendanceReportInput['programCycle'];
  averageAttendance: number | null;
  youth: Array<YouthRow & {
    presentCount: number;
    lateCount: number;
    absentCount: number;
    sessions: Array<Omit<AttendanceSessionRow, 'youthId'> & { sessionNotes: SessionNoteRow[] }>;
  }>;
}

/**
 * Loads saved attendance grouped by program/cycle, with the same records for every filter.
 * @param user - Signed-in account whose program assignments limit discovery.
 * @param filterValues - Requested youth IDs and optional session/program/cycle IDs; an empty youth list matches no records.
 * @param query - Database client; pass trx to read authoritative saved attendance before commit.
 * @returns Saved session attendance and linked notes; no records is { groups: [] }.
 * @example getAttendance(user, { youthIds: [youthId], cycleId }) // the caller supplies the selected cycle ID
 */
export async function getAttendance(
  user: AccessTokenPayload,
  filterValues: AttendanceFilters = {},
  query = sql,
): Promise<{ groups: AttendanceGroup[] }> {
  const { youthIds, sessionId, programId, cycleId } = filterValues;

  // 1. Authorize explicit targets before discovering matching participation.
  if (programId && cycleId) await assertProgramCycleAccess(user, programId, cycleId);
  else if (programId) await assertProgramAccess(user, programId);

  // 2. Read saved attendance with its session, program, cycle and youth details.
  const filters = [programAccessPredicate(user, query`session.program_id`)];
  if (youthIds) filters.push(query`attendance.youth_id = ANY(${query.array(youthIds)}::uuid[])`);
  if (sessionId) filters.push(query`session.id = ${sessionId}`);
  if (programId) filters.push(query`session.program_id = ${programId}`);
  if (cycleId) filters.push(query`session.cycle_id = ${cycleId}`);
  let appliedFilters = query`TRUE`;
  for (const filter of filters) appliedFilters = query`${appliedFilters} AND ${filter}`;

  const groups = await query<AttendanceGroup[]>`
    WITH records AS (
      SELECT
        attendance.youth_id, attendance.status, attendance.notes,
        session.id, session.program_id, session.cycle_id, session.title,
        session.date, to_char(session.start_time, 'HH24:MI') AS start_time,
        session.cancelled_at, session.session_type,
        youth.first_name, youth.last_name,
        session.date < CURRENT_DATE AS completed,
        session.date < CURRENT_DATE AND session.cancelled_at IS NULL AS counted
      FROM attendance_records attendance
      INNER JOIN program_sessions session ON session.id = attendance.session_id
      INNER JOIN users youth ON youth.id = attendance.youth_id
      WHERE ${appliedFilters}
    ),
    notes AS (
      SELECT
        note.session_id, link.youth_id,
        JSON_AGG(JSON_BUILD_OBJECT(
          'id', note.id, 'sessionId', note.session_id, 'category', note.category,
          'details', note.details, 'createdAt', note.created_at, 'updatedAt', note.updated_at,
          'createdByName', CONCAT_WS(' ', author.first_name, author.last_name),
          'youth', (
            SELECT JSON_AGG(JSON_BUILD_OBJECT(
              'youthId', youth.id, 'firstName', youth.first_name, 'lastName', youth.last_name
            ) ORDER BY youth.first_name, youth.last_name, youth.id)
            FROM session_note_has_youth linked
            INNER JOIN users youth ON youth.id = linked.youth_id
            WHERE linked.note_id = note.id
          )
        ) ORDER BY note.created_at DESC, note.id DESC) AS session_notes
      FROM session_notes note
      INNER JOIN session_note_has_youth link ON link.note_id = note.id
      LEFT JOIN users author ON author.id = note.created_by
      WHERE EXISTS (
        SELECT 1 FROM records
        WHERE records.id = note.session_id AND records.youth_id = link.youth_id
      )
      GROUP BY note.session_id, link.youth_id
    ),
    participants AS (
      SELECT
        record.program_id, record.cycle_id, record.youth_id, record.first_name, record.last_name,
        COUNT(*) FILTER (WHERE record.counted AND record.status = 'present')::int AS present_count,
        COUNT(*) FILTER (WHERE record.counted AND record.status = 'late')::int AS late_count,
        COUNT(*) FILTER (WHERE record.counted AND record.status IN ('absent', 'excused'))::int AS absent_count,
        JSON_AGG(JSON_BUILD_OBJECT(
          'id', record.id, 'title', record.title, 'date', record.date, 'startTime', record.start_time,
          'completed', record.completed, 'cancelledAt', record.cancelled_at, 'sessionType', record.session_type,
          'status', record.status, 'notes', record.notes, 'sessionNotes', COALESCE(notes.session_notes, '[]'::json)
        ) ORDER BY record.date DESC, record.start_time DESC, record.id DESC) AS sessions
      FROM records record
      LEFT JOIN notes ON notes.session_id = record.id AND notes.youth_id = record.youth_id
      GROUP BY record.program_id, record.cycle_id, record.youth_id, record.first_name, record.last_name
    )
    SELECT
      JSON_BUILD_OBJECT(
        'programId', participant.program_id, 'cycleId', participant.cycle_id,
        'program', program.title, 'cycle', cycle.title, 'enrollmentRequired', program.enrollment_required
      ) AS program_cycle,
      ROUND(100.0 * SUM(participant.present_count + participant.late_count)
        / NULLIF(SUM(participant.present_count + participant.late_count + participant.absent_count), 0), 1)::float8 AS average_attendance,
      JSON_AGG(JSON_BUILD_OBJECT(
        'id', participant.youth_id, 'firstName', participant.first_name, 'lastName', participant.last_name,
        'presentCount', participant.present_count, 'lateCount', participant.late_count,
        'absentCount', participant.absent_count, 'sessions', participant.sessions
      ) ORDER BY participant.first_name, participant.last_name, participant.youth_id) AS youth
    FROM participants participant
    INNER JOIN programs program ON program.id = participant.program_id
    INNER JOIN program_cycles cycle ON cycle.id = participant.cycle_id
    GROUP BY participant.program_id, participant.cycle_id, program.title, program.enrollment_required, cycle.title, cycle.starts_on
    ORDER BY cycle.starts_on DESC, participant.program_id, participant.cycle_id
  `;
  return { groups };
}

/**
 * Saves one youth's attendance across a program cycle.
 * @param youthId - Youth whose attendance changes.
 * @param programId - Program to update.
 * @param cycleId - Cycle to update.
 * @param data - Validated complete session attendance.
 * @param user - User whose program access is checked.
 * @example setAttendance(youthId, programId, cycleId, data, user)
 */
export async function setAttendance(
  youthId: string,
  programId: string,
  cycleId: string,
  data: SetAttendanceInput,
  user: AccessTokenPayload,
) {
  // 1. Check access to the program cycle.
  await assertProgramCycleAccess(user, programId, cycleId);

  return sql.begin(async tx => {
    const trx = asTransactionSql(tx);

    // 2. Lock the program assignment.
    await lockAssignmentProgram(trx, programId, user);
    const [programCycle] = await trx<{ enrollmentRequired: boolean; enrolledOn: string | null; withdrawnOn: string | null }[]>`
      SELECT program.enrollment_required, enrollment.enrolled_on, enrollment.withdrawn_on
      FROM program_cycle_assignments assignment
      INNER JOIN programs program ON program.id = assignment.program_id
      LEFT JOIN program_enrollments enrollment
        ON enrollment.program_id = assignment.program_id AND enrollment.cycle_id = assignment.cycle_id
        AND enrollment.youth_id = ${youthId}
      WHERE assignment.program_id = ${programId} AND assignment.cycle_id = ${cycleId}
        AND ${programAccessPredicate(user, trx`assignment.program_id`)}
      FOR UPDATE OF assignment
    `;
    if (!programCycle) throw new NotFoundError('Program cycle not found');

    // 3. Check the submitted sessions and attendance.
    const profiles = await trx`SELECT 1 FROM youth_profiles WHERE user_id = ${youthId}`;
    if (!profiles.length) throw new NotFoundError('Youth profile not found');
    const sessions = await trx<{ id: string; date: string; attendanceId: string | null }[]>`
      SELECT session.id, session.date, attendance.id AS attendance_id
      FROM program_sessions session
      LEFT JOIN attendance_records attendance ON attendance.session_id = session.id AND attendance.youth_id = ${youthId}
      WHERE session.program_id = ${programId} AND session.cycle_id = ${cycleId}
      ORDER BY session.id
      FOR UPDATE OF session
    `;
    const savedSessions = sessions.filter(session => session.attendanceId !== null);
    const sessionIds = new Set(data.records.map(record => record.sessionId));
    const submittedSessions = sessions.filter(session => sessionIds.has(session.id));
    if (submittedSessions.length !== sessionIds.size || savedSessions.some(session => !sessionIds.has(session.id))) {
      throw new ConflictError('Saved attendance changed while attendance was being edited');
    }

    if (programCycle.enrollmentRequired) {
      if (programCycle.enrolledOn === null) throw new ConflictError('Youth is not enrolled in this program cycle');
      const enrolledOn = programCycle.enrolledOn;
      const outsideEnrollment = submittedSessions.some(session => session.attendanceId === null && (
        session.date < enrolledOn || (programCycle.withdrawnOn !== null && session.date >= programCycle.withdrawnOn)
      ));
      if (outsideEnrollment) throw new ConflictError('Youth was not enrolled on the session date');
    }
    if (
      !programCycle.enrollmentRequired
      && data.records.some(record => record.status !== null && record.status !== 'present')
    ) {
      throw new ConflictError('Open sessions only record whether a youth attended');
    }

    // 4. Clear unmarked records and save the remaining marks in one bulk upsert.
    const records = trx.json(data.records);
    await trx`
      DELETE FROM attendance_records attendance
      USING jsonb_to_recordset(${records}::jsonb) AS record("sessionId" uuid, status text)
      WHERE attendance.youth_id = ${youthId} AND attendance.session_id = record."sessionId"
        AND record.status IS NULL
    `;
    await trx`
      INSERT INTO attendance_records (session_id, youth_id, status, notes, marked_at, marked_by)
      SELECT record."sessionId", ${youthId}, record.status::attendance_status, record.notes, NOW(), ${user.userId}
      FROM jsonb_to_recordset(${records}::jsonb) AS record("sessionId" uuid, status text, notes text)
      WHERE record.status IS NOT NULL
      ON CONFLICT (session_id, youth_id) DO UPDATE SET
        status = EXCLUDED.status,
        notes = EXCLUDED.notes,
        marked_at = EXCLUDED.marked_at,
        marked_by = EXCLUDED.marked_by,
        updated_at = NOW()
    `;

    // 5. Return the affected rows.
    const [youth] = await getYouthRows(trx`youth.id = ${youthId}`, trx);
    if (!youth) throw new NotFoundError('Youth profile not found');
    const updatedSessions = user.permissions.includes('read:sessions')
      ? await trx<SessionRow[]>`
          SELECT session.*
          FROM (${buildSessionFilters(getSessionRows(user, trx), { ids: [...sessionIds] }, trx)}) session
          ORDER BY session.id
        `
      : undefined;
    const updatedProgramCycle = user.permissions.includes('read:programs')
      ? (await getProgramCycleRowsByKeys(trx, user, [{ programId, cycleId }]))[0]
      : undefined;
    const attendance = await getAttendance(user, { youthIds: [youthId], programId, cycleId }, trx);
    return { attendance, updatedYouth: youth, updatedSessions, updatedProgramCycle };
  });
}
