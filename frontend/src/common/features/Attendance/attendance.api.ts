import { apiClient, type RequestOptions } from '../../../http/client';

/** Full cycle attendance shared by dashboard consumers, editors and PDF rendering. */
export interface AttendanceData {
  averageAttendance?: number | null;
  programCycle: {
    programId: string; cycleId: string; program: string; cycle: string; enrollmentRequired: boolean;
  };
  youth: Array<{
    id: string;
    firstName: string;
    lastName: string;
    presentCount: number;
    lateCount: number;
    /** Completed sessions marked absent/excused or left unmarked. */
    absentCount: number;
    sessions: Array<{
      id: string;
      sessionType: string;
      theme: string;
      date: string;
      startTime: string;
      endTime: string;
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

/**
 * Loads complete cycle attendance for all participating youth.
 * @param programCycle - Program and cycle identifying the attendance to read.
 * @param options - Request options, including cancellation on selection changes.
 * @example getProgramCycleAttendance(assignment, { signal }) // complete cycle data before opening the report
 */
export function getProgramCycleAttendance(programCycle: { programId: string; cycleId: string }, options?: RequestOptions) {
  return apiClient.get<AttendanceData>(`/programs/${programCycle.programId}/cycles/${programCycle.cycleId}/attendance`, options);
}

/**
 * Loads attendance for the youth's active enrolled cycle.
 * @param youthId - Selected youth ID.
 * @param options - Request options, including cancellation when selection changes.
 * @returns The same cycle attendance data used by Programs, or null when not enrolled.
 * @example getYouthAttendance(youthId, { signal }) // the shared attendance reader with a youth filter
 */
export function getYouthAttendance(youthId: string, options?: RequestOptions) {
  return apiClient.get<AttendanceData | null>(`/youth/${youthId}/attendance`, options);
}

/**
 * Renders a PDF from attendance already loaded by its dashboard.
 * @param data - Complete cycle attendance with the selected youth or all participants.
 * @param options - Request options, including cancellation when the viewer closes.
 * @example getAttendanceReportPdf(data, { signal }) // PDF without another attendance read
 */
export function getAttendanceReportPdf(data: AttendanceData, options?: RequestOptions) {
  const { programId, cycleId } = data.programCycle;
  return apiClient.postDownload(`/programs/${programId}/cycles/${cycleId}/reports/youth.pdf`, data, options);
}
