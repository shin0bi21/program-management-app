import { sql } from '../../../db/client';
import { NotFoundError } from '../../../errors';
import { assertCanAccessProgramCycle } from '../../../policies/programAccessPolicy';
import type { AccessTokenPayload } from '../../../types/auth';

type AttendanceStatus = 'present' | 'late' | 'absent' | 'excused';
type ReportStatus = AttendanceStatus | 'unmarked';
type AttendanceBreakdown = Record<ReportStatus, number> & {
  name: string;
  attendedCount: number;
  countedCount: number;
  attendanceRate: number | null;
};
type ReportYouth = { youthId: string; firstName: string; lastName: string };
type SessionTypeRow = { name: string };
type TimelineRow = { youthId: string; sessionId: string; sessionTypeName: string; sessionTheme: string | null; startsAt: string; status: AttendanceStatus | null };
type NoteRow = {
  id: string; youthId: string; sessionId: string; sessionTheme: string | null; startsAt: string;
  category: 'general' | 'attendance' | 'behaviour' | 'achievement';
  details: string;
};

const emptyCounts = () => ({ present: 0, late: 0, absent: 0, excused: 0, unmarked: 0 });

export async function getProgramCycleYouthReport(programId: string, cycleId: string, actor: AccessTokenPayload, youthId?: string) {
  await assertCanAccessProgramCycle(actor, programId, cycleId);
  const programCycles = await sql<{ programId: string; cycleId: string; cycleName: string; programName: string; enrollmentRequired: boolean }[]>`
    SELECT programCycle.program_id, programCycle.cycle_id, cycle.name AS cycle_name, program.name AS program_name, program.enrollment_required
    FROM program_cycle_assignments programCycle
    INNER JOIN program_cycles cycle ON cycle.id = programCycle.cycle_id
    INNER JOIN programs program ON program.id = programCycle.program_id
    WHERE programCycle.program_id = ${programId} AND programCycle.cycle_id = ${cycleId}
  `;
  if (!programCycles.length) throw new NotFoundError('Program cycle not found');

  const sessionTypes = await sql<SessionTypeRow[]>`
    SELECT name
    FROM session_types
    ORDER BY CASE name WHEN 'Regular' THEN 1 WHEN 'Guest Speaker' THEN 2 WHEN 'Field Trip' THEN 3 ELSE 4 END, name
  `;

  const youth = await sql<ReportYouth[]>`
    SELECT DISTINCT person.id AS youth_id, person.first_name, person.last_name
    FROM users person
    WHERE person.id IN (
      SELECT enrollment.youth_id FROM program_enrollments enrollment WHERE enrollment.program_id = ${programId} AND enrollment.cycle_id = ${cycleId}
      UNION
      SELECT attendance.youth_id
      FROM attendance_records attendance
      INNER JOIN program_sessions session ON session.id = attendance.session_id
      WHERE session.program_id = ${programId} AND session.cycle_id = ${cycleId}
    )
      AND (${youthId ?? null}::uuid IS NULL OR person.id = ${youthId ?? null})
    ORDER BY person.first_name, person.last_name
  `;

  const timeline = await sql<TimelineRow[]>`
    SELECT roster.youth_id, session.id AS session_id, session_type.name AS session_type_name,
      session.theme AS session_theme, session.starts_at, attendance.status
    FROM program_sessions session
    INNER JOIN session_types session_type ON session_type.id = session.session_type_id
    INNER JOIN programs program ON program.id = ${programId}
    INNER JOIN LATERAL (
      SELECT enrollment.youth_id
      FROM program_enrollments enrollment
      WHERE enrollment.program_id = ${programId} AND enrollment.cycle_id = ${cycleId}
        AND (enrollment.withdrawn_on IS NULL OR enrollment.withdrawn_on > (session.starts_at AT TIME ZONE 'America/Toronto')::date)
      UNION
      SELECT record.youth_id FROM attendance_records record WHERE record.session_id = session.id
    ) roster ON TRUE
    LEFT JOIN attendance_records attendance ON attendance.session_id = session.id AND attendance.youth_id = roster.youth_id
    WHERE session.program_id = ${programId} AND session.cycle_id = ${cycleId}
      AND (${youthId ?? null}::uuid IS NULL OR roster.youth_id = ${youthId ?? null})
      AND session.cancelled_at IS NULL
      AND session.ends_at <= NOW()
      AND (program.enrollment_required = TRUE OR attendance.id IS NOT NULL)
    ORDER BY session.starts_at
  `;

  const notes = await sql<NoteRow[]>`
    SELECT note.id, link.youth_id, note.session_id, session.theme AS session_theme,
      session.starts_at, note.category, note.details
    FROM session_note_has_youth link
    INNER JOIN session_notes note ON note.id = link.note_id
    INNER JOIN program_sessions session ON session.id = note.session_id
    WHERE session.program_id = ${programId} AND session.cycle_id = ${cycleId}
      AND (${youthId ?? null}::uuid IS NULL OR link.youth_id = ${youthId ?? null})
      AND session.cancelled_at IS NULL
      AND session.ends_at <= NOW()
    ORDER BY session.starts_at, note.created_at
  `;

  const timelineByYouth = new Map<string, TimelineRow[]>();
  for (const record of timeline) {
    const records = timelineByYouth.get(record.youthId) ?? [];
    records.push(record);
    timelineByYouth.set(record.youthId, records);
  }

  const notesByYouth = new Map<string, NoteRow[]>();
  const noteCategoriesByYouthSession = new Map<string, Set<NoteRow['category']>>();
  for (const note of notes) {
    const youthNotes = notesByYouth.get(note.youthId) ?? [];
    youthNotes.push(note);
    notesByYouth.set(note.youthId, youthNotes);
    const key = `${note.youthId}:${note.sessionId}`;
    const categories = noteCategoriesByYouthSession.get(key) ?? new Set<NoteRow['category']>();
    categories.add(note.category);
    noteCategoriesByYouthSession.set(key, categories);
  }

  return {
    programCycle: programCycles[0],
    youth: youth.map(person => {
      const records = timelineByYouth.get(person.youthId) ?? [];
      const youthNotes = notesByYouth.get(person.youthId) ?? [];
      return {
        id: person.youthId,
        firstName: person.firstName,
        lastName: person.lastName,
        attendanceBreakdown: buildAttendanceBreakdown(sessionTypes, records),
        notes: youthNotes.map(note => ({
          id: note.id,
          sessionId: note.sessionId,
          sessionTheme: note.sessionTheme,
          startsAt: note.startsAt,
          category: note.category,
          details: note.details,
        })),
        timeline: records.map(record => ({
          sessionId: record.sessionId,
          sessionTypeName: record.sessionTypeName,
          sessionTheme: record.sessionTheme,
          startsAt: record.startsAt,
          status: record.status,
          noteCategories: Array.from(noteCategoriesByYouthSession.get(`${person.youthId}:${record.sessionId}`) ?? []),
        })),
      };
    }),
  };
}

export type ProgramCycleYouthReport = Awaited<ReturnType<typeof getProgramCycleYouthReport>>;

function completeBreakdown(name: string, counts: ReturnType<typeof emptyCounts>): AttendanceBreakdown {
  const attendedCount = counts.present + counts.late;
  const countedCount = attendedCount + counts.absent + counts.unmarked;
  return {
    name,
    ...counts,
    attendedCount,
    countedCount,
    attendanceRate: countedCount ? Math.round((attendedCount / countedCount) * 1000) / 10 : null,
  };
}

function buildAttendanceBreakdown(sessionTypes: SessionTypeRow[], records: TimelineRow[]) {
  const countsByType = new Map(sessionTypes.map(type => [type.name, emptyCounts()]));
  const totalCounts = emptyCounts();
  for (const record of records) {
    const status = record.status ?? 'unmarked';
    const typeCounts = countsByType.get(record.sessionTypeName) ?? emptyCounts();
    typeCounts[status] += 1;
    totalCounts[status] += 1;
    countsByType.set(record.sessionTypeName, typeCounts);
  }
  return {
    bySessionType: Array.from(countsByType, ([name, counts]) => completeBreakdown(name, counts)),
    total: completeBreakdown('Total', totalCounts),
  };
}
