// Owns YouthAttendanceDashboardCard rendered behavior and owner wiring.
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import YouthAttendanceDashboardCard from './YouthAttendanceDashboardCard';

describe('YouthAttendanceDashboardCard', () => {
  it('keeps its empty state inside the dashboard card', () => {
    render(<YouthAttendanceDashboardCard cohorts={[]} selected />);
    expect(screen.getByRole('heading', { name: 'Attendance' })).toBeInTheDocument();
    expect(screen.getByText('No active cohort attendance.')).toBeInTheDocument();
  });

  it('separates active and historical attendance by program and cohort', () => {
    render(<YouthAttendanceDashboardCard selected cohorts={[
      {
        id: 'active-cohort', name: 'Summer 2026', programId: 'program-1', programName: 'Soft Skills', rosterMode: 'enrolled',
        startsOn: '2000-01-01', endsOn: '2999-12-31', enrolledOn: '2000-01-01', withdrawnOn: null,
        presentCount: 2, lateCount: 1, absentCount: 0, lastAttendedOn: '2026-07-21',
      },
      {
        id: 'historic-cohort', name: 'Spring 2025', programId: 'program-2', programName: 'Drop In', rosterMode: 'open',
        startsOn: '2025-01-01', endsOn: '2025-06-30', enrolledOn: null, withdrawnOn: null,
        presentCount: 3, lateCount: 0, absentCount: 0, lastAttendedOn: '2025-05-10',
      },
    ]} />);

    expect(screen.getByText('Soft Skills · Summer 2026')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'History' }));
    expect(screen.getByText('Drop In · Spring 2025')).toBeInTheDocument();
    expect(screen.queryByText('Soft Skills · Summer 2026')).not.toBeInTheDocument();
  });

  it('opens youth attendance management for the selected cohort', () => {
    const onManage = vi.fn();
    const cohort = {
      id: 'active-cohort', name: 'Summer 2026', programId: 'program-1', programName: 'Soft Skills', rosterMode: 'enrolled' as const,
      startsOn: '2000-01-01', endsOn: '2999-12-31', enrolledOn: '2000-01-01', withdrawnOn: null,
      presentCount: 2, lateCount: 1, absentCount: 0, lastAttendedOn: '2026-07-21',
    };
    render(<YouthAttendanceDashboardCard selected cohorts={[cohort]} canManage onManage={onManage} />);

    fireEvent.click(screen.getByRole('button', { name: 'Manage attendance for Soft Skills · Summer 2026' }));
    expect(onManage).toHaveBeenCalledWith(cohort);
  });

  it('opens the selected youth report for an enrolled cohort', () => {
    const onViewReport = vi.fn();
    const cohort = {
      id: 'active-cohort', name: 'Summer 2026', programId: 'program-1', programName: 'Soft Skills', rosterMode: 'enrolled' as const,
      startsOn: '2000-01-01', endsOn: '2999-12-31', enrolledOn: '2000-01-01', withdrawnOn: null,
      presentCount: 2, lateCount: 1, absentCount: 0, lastAttendedOn: '2026-07-21',
    };
    render(<YouthAttendanceDashboardCard selected cohorts={[cohort]} canViewReport onViewReport={onViewReport} />);

    fireEvent.click(screen.getByRole('button', { name: 'View attendance report for Soft Skills · Summer 2026' }));
    expect(onViewReport).toHaveBeenCalledWith(cohort);
  });
});
