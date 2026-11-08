import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { YouthAttendanceSummary } from './youthAttendanceSummary.api';
import useYouthAttendanceSummary from './hooks/useYouthAttendanceSummary';
import YouthAttendanceDashboardCard from './YouthAttendanceDashboardCard';

vi.mock('./hooks/useYouthAttendanceSummary', () => ({ default: vi.fn() }));

const enrolled: YouthAttendanceSummary = {
  cycleId: 'cycle-1', cycle: 'Summer 2026', programId: 'program-1', program: 'Soft Skills', enrollmentRequired: true,
  startsOn: '2000-01-01', endsOn: '2999-12-31', enrolledOn: '2000-01-01', withdrawnOn: null,
  presentCount: 2, lateCount: 1, absentCount: 0,
};
const summary = { programCycles: [enrolled], loading: false, error: null, retry: vi.fn() };

describe('YouthAttendanceDashboardCard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useYouthAttendanceSummary).mockReturnValue({ ...summary, programCycles: [] });
  });

  it('shows an empty state when no active attendance exists', () => {
    render(<YouthAttendanceDashboardCard youthId="youth-1" />);
    expect(screen.getByText('No active program attendance.')).toBeInTheDocument();
  });

  it('disables tabs when selection clears and restores the chosen tab', () => {
    const view = render(<YouthAttendanceDashboardCard youthId="youth-1" />);
    fireEvent.click(screen.getByRole('button', { name: 'History' }));

    view.rerender(<YouthAttendanceDashboardCard youthId={null} />);
    expect(screen.getByRole('button', { name: 'History' })).toBeDisabled();
    expect(screen.getByText('Select a row to view attendance.')).toBeInTheDocument();

    view.rerender(<YouthAttendanceDashboardCard youthId="youth-1" />);
    expect(screen.getByRole('button', { name: 'History' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByText('No historical attendance.')).toBeInTheDocument();
  });

  it('separates active enrollments from historical open-program visits', () => {
    vi.mocked(useYouthAttendanceSummary).mockReturnValue({ ...summary, programCycles: [enrolled, {
      ...enrolled, cycleId: 'past', cycle: 'Spring 2025', programId: 'program-2', program: 'Drop In',
      enrollmentRequired: false, startsOn: '2025-01-01', endsOn: '2025-06-30', enrolledOn: null,
      presentCount: 3, lateCount: 0,
    }] });
    render(<YouthAttendanceDashboardCard youthId="youth-1" />);

    expect(screen.getByText('Soft Skills · Summer 2026')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'History' }));
    expect(screen.getByText('Drop In · Spring 2025')).toBeInTheDocument();
    expect(screen.getByText('3 visits')).toBeInTheDocument();
    expect(screen.queryByText('Soft Skills · Summer 2026')).not.toBeInTheDocument();
  });

  it('opens attendance editing and reports with the independently loaded summary', () => {
    vi.mocked(useYouthAttendanceSummary).mockReturnValue(summary);
    const onManage = vi.fn();
    const onViewReport = vi.fn();
    render(<YouthAttendanceDashboardCard youthId="youth-1" canManage canViewReport onManage={onManage} onViewReport={onViewReport} />);

    fireEvent.click(screen.getByRole('button', { name: 'Manage attendance for Soft Skills · Summer 2026' }));
    fireEvent.click(screen.getByRole('button', { name: 'View attendance report for Soft Skills · Summer 2026' }));
    expect(onManage).toHaveBeenCalledWith(enrolled);
    expect(onViewReport).toHaveBeenCalledWith(enrolled);
  });

  it('shows loading and provides retry for a failed summary request', () => {
    vi.mocked(useYouthAttendanceSummary).mockReturnValue({ ...summary, programCycles: [], loading: true });
    const view = render(<YouthAttendanceDashboardCard youthId="youth-1" />);
    expect(screen.getByRole('status', { name: 'Loading attendance…' })).toBeInTheDocument();

    vi.mocked(useYouthAttendanceSummary).mockReturnValue({ ...summary, error: 'Could not load attendance.' });
    view.rerender(<YouthAttendanceDashboardCard youthId="youth-1" />);
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
    expect(summary.retry).toHaveBeenCalledOnce();
  });
});
