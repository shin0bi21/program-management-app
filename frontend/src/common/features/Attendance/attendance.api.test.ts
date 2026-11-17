// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { apiClient } from '../../../http/client';
import { getAttendance, getAttendanceReportPdf } from './attendance.api';

vi.mock('../../../http/client', () => ({ apiClient: { get: vi.fn(), postDownload: vi.fn() } }));

describe('attendance API', () => {
  beforeEach(() => vi.clearAllMocks());

  it('serializes youth filters or the cohort assignment and forwards cancellation', () => {
    const options = { signal: new AbortController().signal };
    getAttendance({ youthIds: ['youth-1'], programId: 'program-1', cycleId: 'cycle-1' }, options);
    expect(apiClient.get).toHaveBeenLastCalledWith('/youth/attendance?youthIds=youth-1&programId=program-1&cycleId=cycle-1', options);
    getAttendance({ programId: 'program-1', cycleId: 'cycle-1' }, options);
    expect(apiClient.get).toHaveBeenLastCalledWith('/programs/program-1/cycles/cycle-1/attendance', options);
  });

  it('sends all requested youth IDs and the selected session in one request, including an empty selection', () => {
    getAttendance({ youthIds: ['youth-1', 'youth-2'], sessionId: 'session-1' });
    expect(apiClient.get).toHaveBeenLastCalledWith('/youth/attendance?youthIds=youth-1%2Cyouth-2&sessionId=session-1', undefined);
    getAttendance({ youthIds: [] });
    expect(apiClient.get).toHaveBeenLastCalledWith('/youth/attendance?youthIds=', undefined);
  });

  it('renders supplied cycle attendance as a PDF', () => {
    const options = { signal: new AbortController().signal };
    const data = { programCycle: { programId: 'program-1', cycleId: 'cycle-1', program: 'Skills', cycle: 'Fall', enrollmentRequired: true }, averageAttendance: null, youth: [] };
    getAttendanceReportPdf(data, options);

    expect(apiClient.postDownload).toHaveBeenCalledWith(
      '/programs/program-1/cycles/cycle-1/reports/youth.pdf', data, options,
    );
  });
});
