import { fireEvent, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderWithQueryClient as render } from '../../../../../tests/queryClientTestUtils';
import { makeYouthProfile } from '../../../../../tests/factories/youth';
import type { AttendanceGroup } from '../../../../../common/features/Attendance/attendance.api';
import useYouthAttendanceData from './hooks/useYouthAttendanceData';
import YouthAttendanceDashboardCard from './YouthAttendanceDashboardCard';

vi.mock('./hooks/useYouthAttendanceData', () => ({ default: vi.fn() }));
vi.mock('../../../../../common/features/Attendance/ViewAttendanceModal', () => ({
  default: ({ data }: { data: AttendanceGroup }) => <div role="dialog" aria-label="Attendance report">{data.programCycle.program} · {data.programCycle.cycle}</div>,
}));

const attendance: AttendanceGroup = {
  averageAttendance: 100,
  programCycle: { cycleId: 'cycle-1', cycle: 'Summer 2026', programId: 'program-1', program: 'Soft Skills', enrollmentRequired: true },
  youth: [{ id: 'youth-1', firstName: 'Jamie', lastName: 'Test', presentCount: 1, lateCount: 0, absentCount: 0, sessions: [{
    id: 'session-1', sessionType: 'Regular', title: 'Teamwork',
    date: '2026-07-21', startTime: '17:00', completed: true,
    cancelledAt: null, status: 'present', notes: null, sessionNotes: [],
  }] }],
};
const loaded = { attendance: { groups: [attendance] }, loading: false, error: null, retry: vi.fn() };

describe('YouthAttendanceDashboardCard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useYouthAttendanceData).mockReturnValue({ ...loaded, attendance: null });
  });

  it('shows an empty state when there is no participation', () => {
    render(<YouthAttendanceDashboardCard youthId="youth-1" />);
    expect(screen.getByText('No attendance available.')).toBeInTheDocument();
  });

  it('opens the selected program/cycle group and clears its interaction when youth changes', () => {
    const otherGroup = { ...attendance, programCycle: { ...attendance.programCycle, programId: 'program-2', program: 'Art' } };
    vi.mocked(useYouthAttendanceData).mockReturnValue({ ...loaded, attendance: { groups: [attendance, otherGroup] } });
    const view = render(<YouthAttendanceDashboardCard youthId="youth-1" youth={makeYouthProfile()} canManage canViewReport onSaved={vi.fn()} />);

    expect(screen.getAllByText(/Present 1.*Late 0.*Absent 0/)).toHaveLength(2);
    fireEvent.click(screen.getByRole('button', { name: 'Manage attendance for Soft Skills · Summer 2026' }));
    expect(screen.getByRole('dialog', { name: 'Manage Attendance' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    fireEvent.click(screen.getByRole('button', { name: 'View attendance report for Art · Summer 2026' }));
    expect(screen.getByRole('dialog', { name: 'Attendance report' })).toHaveTextContent('Art · Summer 2026');
    vi.mocked(useYouthAttendanceData).mockReturnValue({ ...loaded, attendance: { groups: [] } });
    view.rerender(<YouthAttendanceDashboardCard youthId="youth-1" youth={makeYouthProfile()} canViewReport />);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    vi.mocked(useYouthAttendanceData).mockReturnValue(loaded);
    view.rerender(<YouthAttendanceDashboardCard youthId="youth-1" youth={makeYouthProfile()} canViewReport />);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'View attendance report for Soft Skills · Summer 2026' }));
    view.rerender(<YouthAttendanceDashboardCard youthId="youth-2" />);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
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
