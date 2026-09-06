import type { AttendanceStatus } from '../../../../common/features/AttendanceStatusSelect/types';
import type { SessionNote } from '../../../Programming/Sessions/types';

export interface YouthAttendanceSession {
  id: string;
  sessionTypeName: string;
  theme: string;
  startsAt: string;
  endsAt: string;
  cancelledAt: string | null;
  status: AttendanceStatus | null;
  notes: string | null;
  sessionNotes: SessionNote[];
}

export interface YouthCohortAttendance {
  cohort: {
    id: string;
    name: string;
    programName: string;
    rosterMode: 'enrolled' | 'open';
  };
  sessions: YouthAttendanceSession[];
}

export interface SetYouthAttendanceRecord {
  sessionId: string;
  status: AttendanceStatus | null;
  notes: string | null;
}

export interface SessionNoteTarget {
  session: YouthAttendanceSession;
  note: SessionNote | null;
}

export interface SessionNoteUnlinkTarget {
  session: YouthAttendanceSession;
  note: SessionNote;
}
