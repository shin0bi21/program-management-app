// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { apiClient } from '../../../http/client';
import { getAttendanceReportPdf } from './attendance.api';

vi.mock('../../../http/client', () => ({ apiClient: { postDownload: vi.fn() } }));

describe('attendance report API', () => {
  beforeEach(() => vi.clearAllMocks());

  it('renders supplied cycle attendance as a PDF', () => {
    const options = { signal: new AbortController().signal };
    const data = { programCycle: { programId: 'program-1', cycleId: 'cycle-1', program: 'Skills', cycle: 'Fall', enrollmentRequired: true }, youth: [] };
    getAttendanceReportPdf(data, options);

    expect(apiClient.postDownload).toHaveBeenCalledWith(
      '/programs/program-1/cycles/cycle-1/reports/youth.pdf', data, options,
    );
  });
});
