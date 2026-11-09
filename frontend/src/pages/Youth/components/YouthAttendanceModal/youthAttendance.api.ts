import type { YouthProfile } from '../../types';
import type { ProgramSession } from '../../../Programming/Sessions/types';
import type { ProgramCycleAssignment } from '../../../Programming/Programs/types';
import { apiClient } from '../../../../http/client';
import type { SetYouthAttendanceRecord, YouthProgramCycleAttendance } from './types';

export interface YouthAttendanceResult extends YouthProgramCycleAttendance {
  presentCount: number;
  lateCount: number;
  absentCount: number;
  youth: YouthProfile;
  updatedSessions?: ProgramSession[];
  updatedProgramCycle?: ProgramCycleAssignment;
}

/**
 * Saves a complete attendance replacement for one youth and cycle.
 * @param youthId - Youth whose session statuses are being saved.
 * @param programCycle - Program/cycle pair displayed by the editor.
 * @param records - Complete eligible session list with saved status and notes.
 * @example setYouthProgramCycleAttendance(youthId, assignment, records)
 */
export function setYouthProgramCycleAttendance(
  youthId: string,
  programCycle: { programId: string; cycleId: string },
  records: SetYouthAttendanceRecord[],
) {
  return apiClient.put<YouthAttendanceResult>(
    `/youth/${youthId}/programs/${programCycle.programId}/cycles/${programCycle.cycleId}/attendance`,
    { records },
  );
}
