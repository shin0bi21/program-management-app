import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import YouthAttendanceDashboardCard from './YouthAttendanceDashboardCard';

describe('YouthAttendanceDashboardCard', () => {
  it('shows an empty state when no active attendance exists', () => {
    render(<YouthAttendanceDashboardCard programCycles={[]} selected />);
    expect(screen.getByText('No active program attendance.')).toBeInTheDocument();
  });

  it('disables tabs when selection clears and restores the chosen tab', () => {
    const view = render(<YouthAttendanceDashboardCard programCycles={[]} selected />);
    const active = screen.getByRole('button', { name: 'Active' });
    const history = screen.getByRole('button', { name: 'History' });
    fireEvent.click(history);

    view.rerender(<YouthAttendanceDashboardCard selected={false} />);

    expect(active).toBeDisabled();
    expect(history).toBeDisabled();
    expect(screen.getByText('Select a row to view attendance.')).toBeInTheDocument();

    view.rerender(<YouthAttendanceDashboardCard programCycles={[]} selected />);

    expect(history).toBeEnabled();
    expect(history).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByText('No historical attendance.')).toBeInTheDocument();
  });

  it('separates active and historical attendance by program and programCycle', () => {
    render(<YouthAttendanceDashboardCard selected programCycles={[
      {
        cycleId: 'cycle-1', cycleName: 'Summer 2026', programId: 'program-1', programName: 'Soft Skills', enrollmentRequired: true,
        startsOn: '2000-01-01', endsOn: '2999-12-31', enrolledOn: '2000-01-01', withdrawnOn: null,
        presentCount: 2, lateCount: 1, absentCount: 0, lastAttendedOn: '2026-07-21',
      },
      {
        cycleId: 'cycle-1', cycleName: 'Spring 2025', programId: 'program-2', programName: 'Drop In', enrollmentRequired: false,
        startsOn: '2025-01-01', endsOn: '2025-06-30', enrolledOn: null, withdrawnOn: null,
        presentCount: 3, lateCount: 0, absentCount: 0, lastAttendedOn: '2025-05-10',
      },
    ]} />);

    expect(screen.getByText('Soft Skills · Summer 2026')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'History' }));
    expect(screen.getByText('Drop In · Spring 2025')).toBeInTheDocument();
    expect(screen.queryByText('Soft Skills · Summer 2026')).not.toBeInTheDocument();
  });

  it('opens youth attendance management for the selected programCycle', () => {
    const onManage = vi.fn();
    const programCycle = {
      cycleId: 'cycle-1', cycleName: 'Summer 2026', programId: 'program-1', programName: 'Soft Skills', enrollmentRequired: true,
      startsOn: '2000-01-01', endsOn: '2999-12-31', enrolledOn: '2000-01-01', withdrawnOn: null,
      presentCount: 2, lateCount: 1, absentCount: 0, lastAttendedOn: '2026-07-21',
    };
    render(<YouthAttendanceDashboardCard selected programCycles={[programCycle]} canManage onManage={onManage} />);

    fireEvent.click(screen.getByRole('button', { name: 'Manage attendance for Soft Skills · Summer 2026' }));
    expect(onManage).toHaveBeenCalledWith(programCycle);
  });

  it('opens the selected youth report for an enrolled programCycle', () => {
    const onViewReport = vi.fn();
    const programCycle = {
      cycleId: 'cycle-1', cycleName: 'Summer 2026', programId: 'program-1', programName: 'Soft Skills', enrollmentRequired: true,
      startsOn: '2000-01-01', endsOn: '2999-12-31', enrolledOn: '2000-01-01', withdrawnOn: null,
      presentCount: 2, lateCount: 1, absentCount: 0, lastAttendedOn: '2026-07-21',
    };
    render(<YouthAttendanceDashboardCard selected programCycles={[programCycle]} canViewReport onViewReport={onViewReport} />);

    fireEvent.click(screen.getByRole('button', { name: 'View attendance report for Soft Skills · Summer 2026' }));
    expect(onViewReport).toHaveBeenCalledWith(programCycle);
  });
});
