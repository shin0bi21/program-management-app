import type { YouthProfile } from '../../types';
import type { ProgramSession } from '../../../Programming/Sessions/types';
import type { ProgramCycleAssignment } from '../../../Programming/Programs/types';
import { apiClient } from '../../../../http/client';
import type { RequestOptions } from '../../../../http/client';
import type { SetYouthAttendanceRecord, YouthProgramCycleAttendance } from './types';

export interface YouthAttendanceResult extends YouthProgramCycleAttendance {
  youth: YouthProfile;
  updatedSessions?: ProgramSession[];
  updatedProgramCycle?: ProgramCycleAssignment;
}

export function getYouthProgramCycleAttendance(
  youthId: string,
  programCycle: { programId: string; cycleId: string },
  opts?: RequestOptions,
) {
  const path = `/youth/${youthId}/programs/${programCycle.programId}/cycles/${programCycle.cycleId}/attendance`;
  return opts
    ? apiClient.get<YouthProgramCycleAttendance>(path, opts)
    : apiClient.get<YouthProgramCycleAttendance>(path);
}

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
