import type { AttendanceStatus } from '../../../../common/types/cohort';

export interface YouthAttendanceSession {
  id: string;
  sessionTypeName: string;
  theme: string | null;
  startsAt: string;
  endsAt: string;
  cancelledAt: string | null;
  status: AttendanceStatus | null;
  notes: string | null;
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
