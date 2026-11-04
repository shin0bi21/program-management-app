import { act, screen } from '@testing-library/react';
import { renderWithQueryClient as render } from '../../../../../tests/queryClientTestUtils';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ProgramSession } from '../../types';
import SessionAttendanceModal from './SessionAttendanceModal';

const api = vi.hoisted(() => ({
  getSessionRoster: vi.fn(),
  setSessionAttendance: vi.fn(),
  searchAttendanceYouth: vi.fn(),
}));

vi.mock('../../sessions.api', () => api);

const session: ProgramSession = {
      id: 'session-1',
  cycleId: 'cycle-1',
      sessionTypeId: 'type-regular',
      sessionTypeName: 'Regular',
  theme: 'Communication',
  cycleName: 'Summer 2026',
  programId: 'program-1',
  programName: 'Soft Skills',
  enrollmentRequired: true,
  startsAt: '2026-07-28T21:00:00.000Z',
  endsAt: '2026-07-28T23:30:00.000Z',
  cancelledAt: null,
  description: null,
  attendanceMarkedCount: 0,
  attendedCount: 0,
  attendanceRate: null,
  state: 'upcoming',
};

describe('SessionAttendanceModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    api.getSessionRoster.mockResolvedValue([{
      youthId: 'youth-1',
      firstName: 'Maya',
      lastName: 'Thompson',
      status: 'present',
      notes: null,
    }]);
    api.setSessionAttendance.mockResolvedValue({ roster: [], session });
    api.searchAttendanceYouth.mockResolvedValue([]);
  });

  it('renders session context and roster failures', async () => {
    api.getSessionRoster.mockRejectedValue(new Error('Roster unavailable'));
    const openSession = { ...session, enrollmentRequired: false };

    render(
      <SessionAttendanceModal
        session={openSession}
        onClose={vi.fn()}
        onSaved={vi.fn()}
      />,
    );

    expect(screen.getByRole('heading', { name: 'Attendance' })).toBeInTheDocument();
    expect(screen.getByText('Jul 28, 2026 · Communication')).toBeInTheDocument();
    expect(await screen.findByRole('alert')).toHaveTextContent('Roster unavailable');
    expect(screen.getByRole('textbox', { name: 'Find youth profile' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled();
  });

  it('checks in an existing youth and locks the pending attendance draft', async () => {
    const user = userEvent.setup();
    let finishSave: (value: unknown[]) => void = () => {};
    api.getSessionRoster.mockResolvedValue([]);
    api.searchAttendanceYouth.mockResolvedValue([{
      id: 'youth-2',
      firstName: 'Jordan',
      lastName: 'Drop In',
    }]);
    api.setSessionAttendance.mockReturnValue(new Promise(resolve => {
      finishSave = resolve;
    }));
    const openSession = { ...session, enrollmentRequired: false, programName: 'Drop In' };
    const onSaved = vi.fn();

    render(
      <SessionAttendanceModal
        session={openSession}
        onClose={vi.fn()}
        onSaved={onSaved}
      />,
    );

    expect(await screen.findByText('No youth have checked in yet.')).toBeInTheDocument();
    expect(screen.queryByText('Late')).not.toBeInTheDocument();

    await user.type(screen.getByRole('textbox', { name: 'Find youth profile' }), 'Jordan');
    await user.click(screen.getByRole('button', { name: 'Search' }));
    await user.click(await screen.findByRole('button', { name: 'Check in' }));
    expect(screen.getByText('Jordan Drop In')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Save' }));

    expect(api.setSessionAttendance).toHaveBeenCalledOnce();
    expect(screen.getByRole('textbox', { name: 'Find youth profile' })).toBeDisabled();
    screen.getAllByRole('button', { name: 'Remove' }).forEach(button => {
      expect(button).toBeDisabled();
    });
    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeDisabled();

    await act(async () => finishSave([]));
    expect(onSaved).toHaveBeenCalledOnce();
  });
});
