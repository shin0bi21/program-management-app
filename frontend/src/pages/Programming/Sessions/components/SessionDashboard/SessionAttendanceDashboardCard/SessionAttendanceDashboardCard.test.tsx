import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { makeCohortSession } from '../../../../../../tests/factories/session';
import SessionAttendanceDashboardCard from './SessionAttendanceDashboardCard';

const session = makeCohortSession({
  attendedCount: 4,
  attendanceMarkedCount: 5,
  attendanceRate: 80,
});

describe('SessionAttendanceDashboardCard', () => {
  it('shows an unselected state and disables its contextual action', () => {
    render(<SessionAttendanceDashboardCard session={null} canWrite onManage={vi.fn()} />);

    expect(screen.getByText('No session selected.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Manage attendance' })).toBeDisabled();
  });

  it('summarizes enrolled attendance and delegates management for the selected session', () => {
    const onManage = vi.fn();
    render(<SessionAttendanceDashboardCard session={session} canWrite onManage={onManage} />);

    expect(screen.getByText('4/5')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Manage attendance' }));
    expect(onManage).toHaveBeenCalledWith(session);
  });

  it('uses check-in language for open sessions', () => {
    render(
      <SessionAttendanceDashboardCard
        session={{ ...session, enrollmentRequired: false, attendanceMarkedCount: 5 }}
        canWrite={false}
        onManage={vi.fn()}
      />,
    );

    expect(screen.getByText('5 check-ins')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Manage attendance' })).not.toBeInTheDocument();
  });
});
