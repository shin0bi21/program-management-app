import { screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderWithQueryClient as render } from '../../../tests/queryClientTestUtils';
import ViewAttendanceModal from './ViewAttendanceModal';

const api = vi.hoisted(() => ({ getReportPdf: vi.fn() }));
vi.mock('./attendance.api', () => ({ getAttendanceReportPdf: api.getReportPdf }));

const programCycle = { programId: 'program-1', cycleId: 'cycle-1', program: 'Soft Skills', cycle: 'Summer 2026', enrollmentRequired: true };

const attendance = { programCycle, youth: [] };

describe('ViewAttendanceModal', () => {
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

  it('loads and displays the generated report for the selected programCycle and optional youth', async () => {
    render(<ViewAttendanceModal data={attendance} onClose={vi.fn()} />);

    expect(screen.getByRole('heading', { name: 'Summer 2026 Attendance Report' })).toBeInTheDocument();
    expect(await screen.findByTitle('Summer 2026 Attendance Report preview')).toHaveAttribute('src', 'blob:youth-report');
    expect(screen.getByRole('link', { name: 'Download PDF' })).toHaveAttribute('href', 'blob:youth-report');
    expect(api.getReportPdf).toHaveBeenCalledWith(
      attendance,
      { signal: expect.any(AbortSignal) },
    );
  });

  it('shows an error when the report cannot be loaded', async () => {
    api.getReportPdf.mockRejectedValue(new Error('failed'));

    render(<ViewAttendanceModal data={attendance} onClose={vi.fn()} />);

    expect(await screen.findByRole('alert')).toHaveTextContent('Could not load attendance report.');
  });
});
