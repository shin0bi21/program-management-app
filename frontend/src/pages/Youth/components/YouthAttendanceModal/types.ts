import type { AttendanceSession } from '../../../../common/features/Attendance/attendance.api';
import type { AttendanceStatus } from '../../../../common/features/AttendanceStatusSelect/types';
import type { SessionNote } from '../../../Programming/Sessions/types';

export interface SetYouthAttendanceRecord {
  sessionId: string;
  status: AttendanceStatus | null;
  notes: string | null;
}

export interface SessionNoteTarget {
  session: AttendanceSession;
  note: SessionNote | null;
}

export interface SessionNoteUnlinkTarget {
  session: AttendanceSession;
  note: SessionNote;
}
