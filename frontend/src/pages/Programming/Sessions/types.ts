import type { DateRange } from '../../../common/utils/dateRange';
import type { AttendanceStatus } from '../../../common/features/AttendanceStatusSelect/types';

export interface ProgramSession {
  id: string;
  cycleId: string;
  sessionTypeId: string;
  sessionTypeName: string;
  theme: string;
  cycleName: string;
  programId: string;
  programName: string;
  enrollmentRequired: boolean;
  startsAt: string;
  endsAt: string;
  cancelledAt: string | null;
  description: string | null;
  attendanceMarkedCount: number;
  attendedCount: number;
  attendanceRate: number | null;
  state: 'upcoming' | 'completed' | 'cancelled';
}

export interface SessionListFilters {
  dateRange?: DateRange;
  programIds?: string[];
  cycleIds?: string[];
  sessionTypeIds?: string[];
  statuses?: SessionStatusFilter[];
  search?: string;
}

export type SessionStatusFilter = 'upcoming' | 'completed';

export const SESSION_TABLE_KEYS = ['program', 'cycle', 'theme', 'date', 'time', 'type', 'status'] as const;
export type SessionSortKey = typeof SESSION_TABLE_KEYS[number];

export interface SessionType {
  id: string;
  name: string;
}

export const REGULAR_SESSION_TYPE_ID = '00000000-0000-4000-8000-000000000001';

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
  | 'achievement';

export interface SessionNote {
  id: string;
  sessionId: string;
  category: SessionNoteCategory;
  details: string;
  createdAt: string;
  updatedAt: string;
  createdByName: string | null;
  youth: SessionNoteYouth[];
}

export interface YouthSessionNote extends SessionNote {
  cycleId: string;
  sessionTheme: string | null;
  startsAt: string;
  cycleName: string;
  programId: string;
  programName: string;
  enrollmentRequired: boolean;
}

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

export interface SessionCalendarCache {
  upsert: (session: ProgramSession) => void;
  remove: (sessionId: string) => void;
}
