export interface ProgramCohort {
  id: string;
  programId: string;
  programName: string;
  rosterMode: 'enrolled' | 'open';
  minAge: number | null;
  maxAge: number | null;
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

export interface CohortSession {
  id: string;
  cohortId: string;
  theme: string | null;
  cohortName: string;
  programId: string;
  programName: string;
  rosterMode: 'enrolled' | 'open';
  startsAt: string;
  endsAt: string;
  cancelledAt: string | null;
  description: string | null;
}

export interface CreateCohortInput {
  programId: string;
  name: string;
  startsOn: string;
  endsOn: string;
}
export type UpdateCohortInput = Omit<CreateCohortInput, 'programId'>;
export interface UpdateSessionInput {
  theme: string | null;
  startsAt: string;
  endsAt: string;
  description?: string | null;
}

export interface EnrollYouthInput {
  youthIds: string[];
}

export interface GenerateSessionsInput {
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

export interface ManagedSession extends CohortSession {
  attendanceMarkedCount: number;
  attendedCount: number;
  attendanceRate: number | null;
  state: 'upcoming' | 'completed' | 'cancelled';
}

export interface SessionListFilters {
  programIds?: string[];
  cohortId?: string;
  statuses?: Array<'upcoming' | 'completed'>;
  search?: string;
}

export interface SessionCalendarFilters extends SessionListFilters {
  start: string;
  end: string;
}

export type AttendanceStatus = 'present' | 'absent' | 'late' | 'excused';

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
  details: string;
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
}

export interface CreateSessionNoteInput {
  category: SessionNoteCategory;
  title: string;
  details: string;
  youthIds: string[];
}

export type UpdateSessionNoteInput = CreateSessionNoteInput;
