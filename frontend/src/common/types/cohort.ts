export interface ProgramCohort {
  id: string;
  programId: string;
  programName: string;
  rosterMode: 'enrolled' | 'open';
  minAge: number | null;
  maxAge: number | null;
  cycleId: string;
  cycleName: string;
  name: string;
  startsOn: string;
  endsOn: string;
  state: 'upcoming' | 'active' | 'completed';
  enrolledCount: number;
  nextSessionAt: string | null;
  nextSessionId: string | null;
  averageAttendance: number | null;
  attendanceAttendedCount: number;
  attendanceRecordedCount: number;
  uniqueAttendeeCount: number;
}

export interface ProgramCycle {
  id: string;
  name: string;
  startsOn: string;
  endsOn: string;
  state: 'upcoming' | 'active' | 'completed';
}
export type CohortSortKey = 'program' | 'cohort' | 'start' | 'end' | 'status';

export interface CohortSession {
  id: string;
  cohortId: string;
  sessionTypeId: string;
  sessionTypeName: string;
  theme: string | null;
  cohortName: string;
  programId: string;
  programName: string;
  rosterMode: 'enrolled' | 'open';
  startsAt: string;
  endsAt: string;
  cancelledAt: string | null;
  description: string | null;
  attendanceMarkedCount: number;
  attendedCount: number;
  attendanceRate: number | null;
  state: 'upcoming' | 'completed' | 'cancelled';
}

export interface CreateCohortInput {
  programId: string;
  cycleId: string;
}
export type UpdateCohortInput = Pick<CreateCohortInput, 'cycleId'>;
export interface SetProgramCycleInput {
  name: string;
  startsOn: string;
  endsOn: string;
}
export interface UpdateSessionInput {
  sessionTypeId: string;
  theme: string | null;
  startsAt: string;
  endsAt: string;
  description?: string | null;
}

export interface EnrollYouthInput {
  youthIds: string[];
}

export interface GenerateSessionsInput {
  sessionTypeId: string;
  theme: string | null;
  frequency: 'once' | 'weekly' | 'biweekly' | 'monthly';
  dayOfWeek?: 'sunday' | 'monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday' | 'saturday';
  dayOfMonth?: number;
  startsOn: string;
  endsOn?: string;
  startTime: string;
  endTime: string;
}

export interface GenerateSessionsResult {
  sessions: Array<{ id: string }>;
}

export interface SessionListFilters {
  programIds?: string[];
  cohortId?: string;
  sessionTypeIds?: string[];
  statuses?: Array<'upcoming' | 'completed'>;
  search?: string;
}
export type SessionSortKey = 'program' | 'cohort' | 'theme' | 'date' | 'time' | 'type' | 'status';

export interface SessionCalendarFilters extends SessionListFilters {
  start: string;
  end: string;
}

export interface SessionType {
  id: string;
  name: string;
}

export const REGULAR_SESSION_TYPE_ID = '00000000-0000-4000-8000-000000000001';

export type AttendanceStatus = 'present' | 'absent' | 'late' | 'excused';

export interface AttendanceBreakdown {
  name: string;
  present: number;
  late: number;
  absent: number;
  excused: number;
  unmarked: number;
  attendedCount: number;
  countedCount: number;
  attendanceRate: number | null;
}

export interface CohortYouthReport {
  cohort: { id: string; name: string; programName: string; rosterMode: 'enrolled' | 'open' };
  youth: Array<{
    id: string; firstName: string; lastName: string;
    attendanceBreakdown: {
      bySessionType: AttendanceBreakdown[];
      total: AttendanceBreakdown;
    };
    notes: Array<{
      id: string;
      sessionId: string;
      sessionTheme: string | null;
      startsAt: string;
      category: SessionNoteCategory;
      title: string;
      details: string | null;
    }>;
    timeline: Array<{
      sessionId: string;
      sessionTypeName: string;
      sessionTheme: string | null;
      startsAt: string;
      status: AttendanceStatus | null;
      noteCategories: SessionNoteCategory[];
    }>;
  }>;
}

export interface SessionRosterMember {
  youthId: string;
  firstName: string;
  lastName: string;
  status: AttendanceStatus | null;
  notes: string | null;
}

export interface SessionNoteYouth {
  youthId: string;
  firstName: string;
  lastName: string;
}

export type SessionNoteCategory =
  | 'general'
  | 'attendance'
  | 'behaviour'
  | 'achievement'
  | 'follow_up';

export interface SessionNote {
  id: string;
  sessionId: string;
  category: SessionNoteCategory;
  title: string;
  details: string | null;
  createdAt: string;
  updatedAt: string;
  createdByName: string | null;
  youth: SessionNoteYouth[];
}

export interface YouthSessionNote extends SessionNote {
  sessionTheme: string | null;
  startsAt: string;
  cohortId: string;
  cohortName: string;
  programId: string;
  programName: string;
  rosterMode: 'enrolled' | 'open';
}

export interface CreateSessionNoteInput {
  category: SessionNoteCategory;
  title: string;
  details: string | null;
  youthIds: string[];
}

export type UpdateSessionNoteInput = CreateSessionNoteInput;

export interface SessionAttachmentYouth {
  youthId: string;
  firstName: string;
  lastName: string;
}

export interface SessionAttachment {
  id: string;
  sessionId: string;
  title: string;
  description: string | null;
  originalFilename: string;
  mimeType: string;
  fileSize: number;
  createdAt: string;
  updatedAt: string;
  createdByName: string | null;
  youth: SessionAttachmentYouth[];
}

export interface UpdateSessionAttachmentInput {
  title: string;
  description: string | null;
  youthIds: string[];
}
