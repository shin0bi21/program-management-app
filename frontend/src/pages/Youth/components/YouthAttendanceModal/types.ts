import type { AttendanceStatus } from '../../../../common/features/AttendanceStatusSelect/types';
import type { SessionNote } from '../../../Programming/Sessions/types';

export interface YouthAttendanceSession {
  id: string;
  sessionType: string;
  theme: string;
  date: string;
  startTime: string;
  completed: boolean;
  cancelledAt: string | null;
  status: AttendanceStatus | null;
  notes: string | null;
  sessionNotes: SessionNote[];
}

export interface YouthProgramCycleAttendance {
  programCycle: {
    programId: string;
    cycleId: string;
    cycle: string;
    program: string;
    enrollmentRequired: boolean;
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
