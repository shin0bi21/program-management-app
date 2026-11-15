import { fireEvent, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderWithQueryClient as render } from '../../../../../tests/queryClientTestUtils';
import { makeYouthProfile } from '../../../../../tests/factories/youth';
import type { AttendanceData } from '../../../../../common/features/Attendance/attendance.api';
import useYouthAttendanceData from './hooks/useYouthAttendanceData';
import YouthAttendanceDashboardCard from './YouthAttendanceDashboardCard';

vi.mock('./hooks/useYouthAttendanceData', () => ({ default: vi.fn() }));
vi.mock('../../../../../common/features/Attendance/ViewAttendanceModal', () => ({
  default: ({ data }: { data: AttendanceData }) => <div role="dialog" aria-label="Attendance report">{data.programCycle.cycle}</div>,
}));

const attendance: AttendanceData = {
  programCycle: { cycleId: 'cycle-1', cycle: 'Summer 2026', programId: 'program-1', program: 'Soft Skills', enrollmentRequired: true },
  youth: [{ id: 'youth-1', firstName: 'Jamie', lastName: 'Test', presentCount: 1, lateCount: 0, absentCount: 0, sessions: [{
    id: 'session-1', sessionType: 'Regular', title: 'Teamwork',
    date: '2026-07-21', startTime: '17:00', completed: true,
    cancelledAt: null, status: 'present', notes: null, sessionNotes: [],
  }] }],
};
const loaded = { attendance, loading: false, error: null, retry: vi.fn() };

describe('YouthAttendanceDashboardCard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useYouthAttendanceData).mockReturnValue({ ...loaded, attendance: null });
  });

  it('shows not enrolled when there is no active enrolled cycle', () => {
    render(<YouthAttendanceDashboardCard youthId="youth-1" />);
    expect(screen.getByText('Not enrolled.')).toBeInTheDocument();
  });

  it('opens editing and the report from the loaded cycle attendance', () => {
    vi.mocked(useYouthAttendanceData).mockReturnValue(loaded);
    render(<YouthAttendanceDashboardCard youthId="youth-1" youth={makeYouthProfile()} canManage canViewReport onSaved={vi.fn()} />);

    expect(screen.getByText(/Present 1.*Late 0.*Absent 0/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Manage attendance for Soft Skills · Summer 2026' }));
    expect(screen.getByRole('dialog', { name: 'Manage Attendance' })).toBeInTheDocument();
    expect(screen.getByText('Teamwork')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    fireEvent.click(screen.getByRole('button', { name: 'View attendance report for Soft Skills · Summer 2026' }));
    expect(screen.getByRole('dialog', { name: 'Attendance report' })).toHaveTextContent('Summer 2026');
  });

  it('shows loading and provides retry for a failed attendance request', () => {
    vi.mocked(useYouthAttendanceData).mockReturnValue({ ...loaded, attendance: null, loading: true });
    const view = render(<YouthAttendanceDashboardCard youthId="youth-1" />);
    expect(screen.getByRole('status', { name: 'Loading attendance…' })).toBeInTheDocument();

    vi.mocked(useYouthAttendanceData).mockReturnValue({ ...loaded, error: 'Could not load attendance.' });
    view.rerender(<YouthAttendanceDashboardCard youthId="youth-1" />);
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
    expect(loaded.retry).toHaveBeenCalledOnce();
  });
});
