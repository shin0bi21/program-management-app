import { screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import render from '../../../../../tests/renderWithQueryClient';
import type { ProgramCohort } from '../../../../../common/types/cohort';
import YouthReportModal from './YouthReportModal';

const api = vi.hoisted(() => ({ getReportPdf: vi.fn() }));
vi.mock('../../../../../common/features/programming/api/programming.api', () => ({ getCohortYouthReportPdf: api.getReportPdf }));

const cohort: ProgramCohort = {
  id: 'cohort-1', programId: 'program-1', programName: 'Soft Skills', rosterMode: 'enrolled',
  cycleId: 'cycle-summer-2026', cycleName: 'Summer 2026',
  name: 'Summer 2026', startsOn: '2026-07-01', endsOn: '2026-09-01', state: 'active', minAge: null, maxAge: null,
  enrolledCount: 5, nextSessionAt: null, nextSessionId: null, averageAttendance: 80,
  attendanceAttendedCount: 4, attendanceRecordedCount: 5, uniqueAttendeeCount: 4,
};

describe('YouthReportModal', () => {
  beforeEach(() => {
    api.getReportPdf.mockReset();
    api.getReportPdf.mockResolvedValue(new Blob(['pdf'], { type: 'application/pdf' }));
    Object.defineProperty(URL, 'createObjectURL', {
      configurable: true,
      value: vi.fn(() => 'blob:youth-report'),
    });
    Object.defineProperty(URL, 'revokeObjectURL', {
      configurable: true,
      value: vi.fn(),
    });
  });

  it('loads and displays the generated report for the selected cohort', async () => {
    render(<YouthReportModal cohort={cohort} onClose={vi.fn()} />);

    expect(screen.getByRole('heading', { name: 'Summer 2026 Youth Report' })).toBeInTheDocument();
    expect(await screen.findByTitle('Youth report PDF preview')).toHaveAttribute('src', 'blob:youth-report');
    expect(screen.getByRole('link', { name: 'Download PDF' })).toHaveAttribute('href', 'blob:youth-report');
    expect(api.getReportPdf).toHaveBeenCalledWith('cohort-1', { signal: expect.any(AbortSignal) });
  });

  it('shows an error when the report cannot be loaded', async () => {
    api.getReportPdf.mockRejectedValue(new Error('failed'));

    render(<YouthReportModal cohort={cohort} onClose={vi.fn()} />);

    expect(await screen.findByRole('alert')).toHaveTextContent('Could not load the youth report.');
  });
});
