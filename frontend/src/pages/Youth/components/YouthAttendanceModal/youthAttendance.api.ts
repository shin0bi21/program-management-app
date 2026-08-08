import { apiClient } from '../../../../common/api/http/client';
import type { RequestOptions } from '../../../../common/api/http/client';
import type { SetYouthAttendanceRecord, YouthCohortAttendance } from './types';

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
  return apiClient.put<YouthCohortAttendance>(
    `/youth/${youthId}/cohorts/${cohortId}/attendance`,
    { records },
  );
}
