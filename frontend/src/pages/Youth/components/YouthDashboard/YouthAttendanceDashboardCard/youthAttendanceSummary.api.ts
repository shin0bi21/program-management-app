import { apiClient, type RequestOptions } from '../../../../../http/client';

export interface YouthAttendanceSummary {
  programId: string;
  program: string;
  cycleId: string;
  cycle: string;
  enrollmentRequired: boolean;
  startsOn: string;
  endsOn: string;
  enrolledOn: string | null;
  withdrawnOn: string | null;
  presentCount: number;
  lateCount: number;
  absentCount: number;
}

/**
 * Loads attendance totals for the youth selected in the dashboard.
 * @param youthId - ID of the selected youth.
 * @param options - Request options, including cancellation when selection changes.
 * @example getYouthAttendanceSummary(youthId, { signal }) // dashboard summaries
 */
export function getYouthAttendanceSummary(youthId: string, options?: RequestOptions) {
  const path = `/youth/${youthId}/attendance-summary`;
  return options
    ? apiClient.get<YouthAttendanceSummary[]>(path, options)
    : apiClient.get<YouthAttendanceSummary[]>(path);
}
