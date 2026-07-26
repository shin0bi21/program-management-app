import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { ManagedSession } from '../../../../common/types/cohort';
import SessionOverview from './SessionOverview';

const session: ManagedSession = {
  id: 'session-1',
  cohortId: 'cohort-1',
  cohortName: 'Summer 2026',
  programId: 'program-1',
  programName: 'Soft Skills',
  rosterMode: 'enrolled',
  theme: 'Communication',
  startsAt: '2026-07-28T21:00:00.000Z',
  endsAt: '2026-07-28T23:00:00.000Z',
  cancelledAt: null,
  description: null,
  state: 'upcoming',
  attendedCount: 4,
  attendanceMarkedCount: 5,
  attendanceRate: 80,
};

describe('SessionOverview', () => {
  it('keeps every card visible before a session is selected', () => {
    render(
      <SessionOverview
        session={null}
        canWriteAttendance
        canWriteNotes
        onAddAttendance={vi.fn()}
      />,
    );

    expect(screen.getByRole('heading', { name: 'Attendance' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Session notes' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Worksheets' })).toBeInTheDocument();
    expect(screen.getAllByText('No session selected.')).toHaveLength(3);
  });

  it('summarizes attendance and delegates the add action', () => {
    const onAddAttendance = vi.fn();
    render(
      <SessionOverview
        session={session}
        canWriteAttendance
        canWriteNotes
        onAddAttendance={onAddAttendance}
      />,
    );

    expect(screen.getByText('4/5')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Add attendance' }));
    expect(onAddAttendance).toHaveBeenCalledWith(session);
    expect(screen.getByRole('button', { name: 'Add notes' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Add worksheets' })).toBeDisabled();
  });
});
