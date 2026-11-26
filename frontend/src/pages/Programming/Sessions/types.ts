import type { DateRange } from '../../../common/utils/dateRange';
import type { AttendanceStatus } from '../../../common/features/AttendanceStatusSelect/types';
import type { Session } from '../../../common/features/programming/sessions/types';

export interface SessionListFilters {
  dateRange?: DateRange;
  programIds?: string[];
  cycleIds?: string[];
  sessionTypes?: string[];
  statuses?: SessionStatusFilter[];
  search?: string;
}

export type SessionStatusFilter = 'upcoming' | 'completed';

export const SESSION_TABLE_KEYS = ['program', 'cycle', 'title', 'date', 'time', 'type', 'status'] as const;
export type SessionSortKey = typeof SESSION_TABLE_KEYS[number];

export interface SessionType {
  id: Session['sessionType'];
  name: string;
}

export const DEFAULT_SESSION_TYPE = 'Regular';

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
  sessionTitle: string | null;
  date: string;
  cycle: string;
  programId: string;
  program: string;
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
  upsert: (session: Session) => void;
  remove: (sessionId: string) => void;
}
