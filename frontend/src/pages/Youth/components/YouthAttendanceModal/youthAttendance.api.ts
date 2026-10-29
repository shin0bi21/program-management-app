import type { YouthProfile } from '../../types';
import type { CohortSession } from '../../../Programming/Sessions/types';
import type { ProgramCohort } from '../../../Programming/Cohorts/types';
import { apiClient } from '../../../../http/client';
import type { RequestOptions } from '../../../../http/client';
import type { SetYouthAttendanceRecord, YouthCohortAttendance } from './types';

export interface YouthAttendanceResult extends YouthCohortAttendance {
  youth: YouthProfile;
  updatedSessions?: CohortSession[];
  updatedCohort?: ProgramCohort;
}

export function getYouthCohortAttendance(
  youthId: string,
  cohortId: string,
  opts?: RequestOptions,
) {
  const path = `/youth/${youthId}/cohorts/${cohortId}/attendance`;
  return opts
    ? apiClient.get<YouthCohortAttendance>(path, opts)
    : apiClient.get<YouthCohortAttendance>(path);
}

export function setYouthCohortAttendance(
  youthId: string,
  cohortId: string,
  records: SetYouthAttendanceRecord[],
) {
  return apiClient.put<YouthAttendanceResult>(
    `/youth/${youthId}/cohorts/${cohortId}/attendance`,
    { records },
  );
}
