import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import AttendanceCard from './AttendanceCard';

describe('AttendanceCard', () => {
  it('keeps its empty state inside the dashboard card', () => {
    render(<AttendanceCard cohorts={[]} selected />);
    expect(screen.getByRole('heading', { name: 'Attendance' })).toBeInTheDocument();
    expect(screen.getByText('No active cohort attendance.')).toHaveClass('dashboard-card__empty');
  });

  it('separates active and historical attendance by program and cohort', () => {
    render(<AttendanceCard selected cohorts={[
      {
        id: 'active-cohort', name: 'Summer 2026', programName: 'Soft Skills', rosterMode: 'enrolled',
        startsOn: '2000-01-01', endsOn: '2999-12-31', withdrawnOn: null,
        presentCount: 2, lateCount: 1, absentCount: 0, lastAttendedOn: '2026-07-21',
      },
      {
        id: 'historic-cohort', name: 'Spring 2025', programName: 'Drop In', rosterMode: 'open',
        startsOn: '2025-01-01', endsOn: '2025-06-30', withdrawnOn: null,
        presentCount: 3, lateCount: 0, absentCount: 0, lastAttendedOn: '2025-05-10',
      },
    ]} />);

    expect(screen.getByText('Soft Skills · Summer 2026')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'History' }));
    expect(screen.getByText('Drop In · Spring 2025')).toBeInTheDocument();
    expect(screen.queryByText('Soft Skills · Summer 2026')).not.toBeInTheDocument();
  });
});
