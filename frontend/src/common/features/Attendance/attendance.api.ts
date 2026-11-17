import { apiClient, type RequestOptions } from '../../../http/client';

/** Attendance is always grouped by its program/cycle assignment. */
export interface AttendanceData {
  groups: AttendanceGroup[];
}

export interface AttendanceFilters {
  youthIds?: string[];
  sessionId?: string;
  programId?: string;
  cycleId?: string;
}

/** One saved-attendance group shared unchanged by dashboards, editors and PDF rendering. */
export interface AttendanceGroup {
  averageAttendance: number | null;
  programCycle: {
    programId: string; cycleId: string; program: string; cycle: string; enrollmentRequired: boolean;
  };
  youth: Array<{
    id: string;
    firstName: string;
    lastName: string;
    presentCount: number;
    lateCount: number;
    /** Completed sessions explicitly marked absent or excused. */
    absentCount: number;
    sessions: Array<{
      id: string;
      sessionType: string;
      title: string;
      date: string;
      startTime: string;
      completed: boolean;
      cancelledAt: string | null;
      status: 'present' | 'late' | 'absent' | 'excused' | null;
      notes: string | null;
      sessionNotes: Array<{
        id: string;
        sessionId: string;
        category: 'general' | 'attendance' | 'behaviour' | 'achievement';
        details: string;
        createdAt: string;
        updatedAt: string;
        createdByName: string | null;
        youth: Array<{ youthId: string; firstName: string; lastName: string }>;
      }>;
    }>;
  }>;
}

export type AttendanceYouth = AttendanceGroup['youth'][number];
export type AttendanceSession = AttendanceYouth['sessions'][number];

/**
 * Loads saved attendance grouped by program/cycle for requested youth IDs or an assignment.
 * @param filters - Requested youth IDs and optional session/program/cycle IDs, or a cohort assignment.
 * @param options - Request options, including cancellation when selection changes.
 * @example getAttendance({ youthIds: [youthId], cycleId }, { signal }) // the caller supplies the selected cycle ID
 */
export function getAttendance(
  filters: AttendanceFilters & ({ youthIds: string[] } | { programId: string; cycleId: string }),
  options?: RequestOptions,
) {
  const params = new URLSearchParams();
  const path = filters.youthIds !== undefined
    ? '/youth/attendance'
    : `/programs/${filters.programId}/cycles/${filters.cycleId}/attendance`;
  if (filters.youthIds !== undefined) {
    params.set('youthIds', filters.youthIds.join(','));
    if (filters.programId) params.set('programId', filters.programId);
    if (filters.cycleId) params.set('cycleId', filters.cycleId);
  }
  if (filters.sessionId) params.set('sessionId', filters.sessionId);
  const query = params.size > 0 ? `?${params.toString()}` : '';
  return apiClient.get<AttendanceData>(`${path}${query}`, options);
}

/**
 * Renders a PDF from attendance already loaded by its dashboard.
 * @param data - Complete cycle attendance with the selected youth or all participants.
 * @param options - Request options, including cancellation when the viewer closes.
 * @example getAttendanceReportPdf(data, { signal }) // PDF without another attendance read
 */
export function getAttendanceReportPdf(data: AttendanceGroup, options?: RequestOptions) {
  const { programId, cycleId } = data.programCycle;
  return apiClient.postDownload(`/programs/${programId}/cycles/${cycleId}/reports/youth.pdf`, data, options);
}
