import { sql } from '../db/client';
import { NotFoundError } from '../errors';
import { assertCanAccessProgramCycle } from '../policies/programAccessPolicy';
import type { AccessTokenPayload } from '../types/auth';
import type { AttendanceReportInput } from '../validation/programmingSchemas';

type AttendanceStatus = 'present' | 'late' | 'absent' | 'excused';
type YouthRow = { id: string; firstName: string; lastName: string };
interface AttendanceSessionRow {
  id: string;
  theme: string;
  startsAt: string;
  endsAt: string;
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

/**
 * Loads complete attendance and linked notes for an authorized program cycle.
 * @param programId - Program whose assignment must be visible to the actor.
 * @param cycleId - Assigned cycle to read, including upcoming and cancelled sessions.
 * @param actor - Signed-in account whose program scope is checked.
 * @param youthId - Optional youth filter; omitted reads all participating youth.
 * @example getProgramCycleAttendance(programId, cycleId, actor, youthId) // same data for dashboards, editing and reports
 */
export async function getProgramCycleAttendance(programId: string, cycleId: string, actor: AccessTokenPayload, youthId?: string) {
  // 1. Require access to the selected program-cycle assignment.
  await assertCanAccessProgramCycle(actor, programId, cycleId);
  const [programCycle] = await sql<AttendanceReportInput['programCycle'][]>`
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
  `;
  if (!programCycle) throw new NotFoundError('Program cycle not found');

  // 2. Load participating youth or the requested profile for its direct attendance view.
  const youth = await sql<YouthRow[]>`
    SELECT
      person.id,
      person.first_name,
      person.last_name
    FROM users person
    INNER JOIN youth_profiles profile ON profile.user_id = person.id
    WHERE (
      (${youthId ?? null}::uuid IS NOT NULL AND person.id = ${youthId ?? null})
      OR (
        ${youthId ?? null}::uuid IS NULL
        AND person.id IN (
          SELECT enrollment.youth_id
          FROM program_enrollments enrollment
          WHERE enrollment.program_id = ${programId} AND enrollment.cycle_id = ${cycleId}
          UNION
          SELECT attendance.youth_id
          FROM attendance_records attendance
          INNER JOIN program_sessions session ON session.id = attendance.session_id
          WHERE session.program_id = ${programId} AND session.cycle_id = ${cycleId}
        )
      )
    )
    ORDER BY person.first_name, person.last_name, person.id
  `;

  // 3. Load eligible sessions and complete linked notes once for the whole selection.
  const sessions = await sql<AttendanceSessionRow[]>`
    SELECT
      session.id,
      session.theme,
      session.starts_at,
      session.ends_at,
      session.cancelled_at,
      session.session_type,

      roster.youth_id,

      attendance.status,
      attendance.notes
    FROM program_sessions session
    INNER JOIN programs program ON program.id = session.program_id
    INNER JOIN LATERAL (
      SELECT enrollment.youth_id
      FROM program_enrollments enrollment
      WHERE enrollment.program_id = session.program_id AND enrollment.cycle_id = session.cycle_id
        AND enrollment.enrolled_on <= (session.starts_at AT TIME ZONE 'America/Toronto')::date
        AND (enrollment.withdrawn_on IS NULL OR enrollment.withdrawn_on > (session.starts_at AT TIME ZONE 'America/Toronto')::date)
      UNION
      SELECT record.youth_id
      FROM attendance_records record
      WHERE record.session_id = session.id
      UNION
      SELECT ${youthId ?? null}::uuid AS youth_id
      WHERE ${youthId ?? null}::uuid IS NOT NULL AND program.enrollment_required = FALSE
    ) roster ON TRUE
    LEFT JOIN attendance_records attendance
      ON attendance.session_id = session.id AND attendance.youth_id = roster.youth_id
    WHERE session.program_id = ${programId} AND session.cycle_id = ${cycleId}
      AND (${youthId ?? null}::uuid IS NULL OR roster.youth_id = ${youthId ?? null})
      AND (program.enrollment_required = TRUE OR attendance.id IS NOT NULL OR ${youthId ?? null}::uuid IS NOT NULL)
    ORDER BY session.starts_at DESC, session.id DESC, roster.youth_id
  `;
  const sessionNotes = await sql<SessionNoteRow[]>`
    SELECT
      note.id,
      note.session_id,
      note.category,
      note.details,
      note.created_at,
      note.updated_at,

      CONCAT_WS(' ', author.first_name, author.last_name) AS created_by_name,
      COALESCE(
        JSON_AGG(
          JSON_BUILD_OBJECT(
            'youthId', linked_youth.id,
            'firstName', linked_youth.first_name,
            'lastName', linked_youth.last_name
          ) ORDER BY linked_youth.first_name, linked_youth.last_name, linked_youth.id
        ) FILTER (WHERE linked_youth.id IS NOT NULL),
        '[]'::json
      ) AS youth
    FROM session_notes note
    INNER JOIN program_sessions session ON session.id = note.session_id
    LEFT JOIN users author ON author.id = note.created_by
    LEFT JOIN session_note_has_youth note_link ON note_link.note_id = note.id
    LEFT JOIN users linked_youth ON linked_youth.id = note_link.youth_id
    WHERE session.program_id = ${programId} AND session.cycle_id = ${cycleId}
      AND (
        ${youthId ?? null}::uuid IS NULL
        OR EXISTS (
          SELECT 1
          FROM session_note_has_youth selected_youth
          WHERE selected_youth.note_id = note.id AND selected_youth.youth_id = ${youthId ?? null}
        )
      )
    GROUP BY note.id, author.id
    ORDER BY note.created_at DESC, note.id DESC
  `;

  // 4. Attach each youth's notes to the sessions already loaded for that youth.
  const notesByYouthSession = new Map<string, SessionNoteRow[]>();
  for (const note of sessionNotes) {
    for (const linkedYouth of note.youth) {
      const key = `${linkedYouth.youthId}:${note.sessionId}`;
      const notes = notesByYouthSession.get(key) ?? [];
      notes.push(note);
      notesByYouthSession.set(key, notes);
    }
  }
  const sessionsByYouth = new Map<string, Array<Omit<AttendanceSessionRow, 'youthId'> & { sessionNotes: SessionNoteRow[] }>>();
  for (const { youthId: sessionYouthId, ...session } of sessions) {
    const youthSessions = sessionsByYouth.get(sessionYouthId) ?? [];
    youthSessions.push({ ...session, sessionNotes: notesByYouthSession.get(`${sessionYouthId}:${session.id}`) ?? [] });
    sessionsByYouth.set(sessionYouthId, youthSessions);
  }

  // 5. Include each youth's counts for completed, noncancelled sessions.
  const now = Date.now();
  const participants = youth.map(person => {
    const youthSessions = sessionsByYouth.get(person.id) ?? [];
    const counts = { presentCount: 0, lateCount: 0, absentCount: 0 };
    for (const session of youthSessions) {
      if (session.cancelledAt !== null || new Date(session.endsAt).getTime() > now) continue;
      if (session.status === 'present') counts.presentCount += 1;
      else if (session.status === 'late') counts.lateCount += 1;
      else counts.absentCount += 1;
    }
    return { ...person, ...counts, sessions: youthSessions };
  });
  const attendance = { programCycle, youth: participants };
  if (youthId) return attendance;

  // 6. Add the cohort average for the Programs display.
  let attendedCount = 0;
  let countedCount = 0;
  for (const person of participants) {
    attendedCount += person.presentCount + person.lateCount;
    countedCount += person.presentCount + person.lateCount + person.absentCount;
  }
  return {
    ...attendance,
    averageAttendance: countedCount ? Math.round((attendedCount / countedCount) * 1000) / 10 : null,
  };
}
