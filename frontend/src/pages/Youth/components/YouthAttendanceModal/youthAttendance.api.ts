import type { YouthProfile } from '../../types';
import type { Session } from '../../../../common/features/programming/sessions/types';
import type { ProgramCycleAssignment } from '../../../Programming/Programs/types';
import { apiClient } from '../../../../http/client';
import type { SetYouthAttendanceRecord } from './types';
import type { AttendanceData } from '../../../../common/features/Attendance/attendance.api';

export interface YouthAttendanceResult {
  attendance: AttendanceData;
  updatedYouth: YouthProfile;
  updatedSessions?: Session[];
  updatedProgramCycle?: ProgramCycleAssignment;
}

/**
 * Saves a complete attendance replacement for one youth and cycle.
 * @param youthId - Youth whose session statuses are being saved.
 * @param programCycle - Program/cycle pair displayed by the editor.
 * @param records - Complete eligible session list with saved status and notes.
 * @example setAttendance(youthId, assignment, records)
 */
export function setAttendance(
  youthId: string,
  programCycle: { programId: string; cycleId: string },
  records: SetYouthAttendanceRecord[],
) {
  return apiClient.put<YouthAttendanceResult>(
    `/youth/${youthId}/programs/${programCycle.programId}/cycles/${programCycle.cycleId}/attendance`,
    { records },
  );
}
