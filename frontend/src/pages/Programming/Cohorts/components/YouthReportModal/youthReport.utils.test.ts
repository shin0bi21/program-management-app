import { describe, expect, it } from 'vitest';
import { formatAttendanceRate } from './youthReport.utils';

describe('youth report attendance breakdown', () => {
  it('formats the report-ready attendance totals supplied by the backend', () => {
    expect(formatAttendanceRate({
      name: 'Regular', present: 2, late: 1, absent: 0, excused: 4, unmarked: 5,
      attendedCount: 3, countedCount: 8, attendanceRate: 37.5,
    })).toBe('3/8 · 37.5%');
  });

  it('shows an em dash when there are no counted sessions', () => {
    expect(formatAttendanceRate({
      name: 'Field Trip', present: 0, late: 0, absent: 0, excused: 0, unmarked: 0,
      attendedCount: 0, countedCount: 0, attendanceRate: null,
    })).toBe('0/0 · —');
  });
});
