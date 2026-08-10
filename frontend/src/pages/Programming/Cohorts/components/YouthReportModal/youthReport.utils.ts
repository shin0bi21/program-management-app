import type { AttendanceBreakdown } from '../../../../../common/types/cohort';

export function formatAttendanceRate(type: AttendanceBreakdown) {
  const rate = type.attendanceRate === null ? '—' : `${type.attendanceRate}%`;
  return `${type.attendedCount}/${type.countedCount} · ${rate}`;
}
