import { screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderWithQueryClient as render } from '../../../tests/queryClientTestUtils';
import YouthReportModal from './YouthReportModal';

const api = vi.hoisted(() => ({ getReportPdf: vi.fn() }));
vi.mock('./youthReport.api', () => ({ getProgramCycleYouthReportPdf: api.getReportPdf }));

const programCycle = { programId: 'program-1', cycleId: 'cycle-1', program: 'Soft Skills', cycle: 'Summer 2026' };

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

  it('loads and displays the generated report for the selected programCycle and optional youth', async () => {
    render(<YouthReportModal programCycle={programCycle} youthId="youth-1" onClose={vi.fn()} />);

    expect(screen.getByRole('heading', { name: 'Summer 2026 Youth Report' })).toBeInTheDocument();
    expect(await screen.findByTitle('Summer 2026 Youth Report preview')).toHaveAttribute('src', 'blob:youth-report');
    expect(screen.getByRole('link', { name: 'Download PDF' })).toHaveAttribute('href', 'blob:youth-report');
    expect(api.getReportPdf).toHaveBeenCalledWith(
      programCycle,
      { youthId: 'youth-1' },
      { signal: expect.any(AbortSignal) },
    );
  });

  it('shows an error when the report cannot be loaded', async () => {
    api.getReportPdf.mockRejectedValue(new Error('failed'));

    render(<YouthReportModal programCycle={programCycle} onClose={vi.fn()} />);

    expect(await screen.findByRole('alert')).toHaveTextContent('Could not load the youth report.');
  });

  it('revokes generated URLs when the report target changes and on unmount', async () => {
    const nextProgramCycle = { ...programCycle, cycleId: 'cycle-2', cycle: 'Fall 2026' };
    api.getReportPdf
      .mockResolvedValueOnce(new Blob(['first'], { type: 'application/pdf' }))
      .mockResolvedValueOnce(new Blob(['second'], { type: 'application/pdf' }));
    vi.mocked(URL.createObjectURL)
      .mockReturnValueOnce('blob:first-report')
      .mockReturnValueOnce('blob:second-report');
    const view = render(<YouthReportModal programCycle={programCycle} onClose={vi.fn()} />);

    expect(await screen.findByTitle('Summer 2026 Youth Report preview')).toHaveAttribute('src', 'blob:first-report');

    view.rerender(<YouthReportModal programCycle={nextProgramCycle} onClose={vi.fn()} />);

    expect(await screen.findByTitle('Fall 2026 Youth Report preview')).toHaveAttribute('src', 'blob:second-report');
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:first-report');

    view.unmount();
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:second-report');
  });
});
