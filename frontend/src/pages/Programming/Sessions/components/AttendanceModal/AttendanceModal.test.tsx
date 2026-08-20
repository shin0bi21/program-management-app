// Owns Attendance composition, accessible errors, nested Youth creation, and pending-state wiring.
import { act, screen } from '@testing-library/react';
import render from '../../../../../tests/renderWithQueryClient';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { CohortSession } from '../../../../../common/types/cohort';
import AttendanceModal from './AttendanceModal';

const api = vi.hoisted(() => ({
  getSessionRoster: vi.fn(),
  setSessionAttendance: vi.fn(),
  getYouth: vi.fn(),
}));

vi.mock('../../../../../common/features/programming/api/sessions.api', () => api);
vi.mock('../../../../../common/features/youth/youth.api', () => ({ getYouth: api.getYouth }));
vi.mock('../../../../../common/features/youth/components/YouthModal/YouthModal', () => ({
  default: ({
    isOpen,
    onClose,
    onSuccess,
  }: {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: (profile: { id: string; firstName: string; lastName: string }) => void;
  }) => isOpen ? (
    <>
      <button
        type="button"
        onClick={() => onSuccess({ id: 'youth-new', firstName: 'New', lastName: 'Visitor' })}
      >
        Finish creating profile
      </button>
      <button type="button" onClick={onClose}>Close created profile</button>
    </>
  ) : null,
}));

const session: CohortSession = {
      id: 'session-1',
      cohortId: 'cohort-1',
      sessionTypeId: 'type-regular',
      sessionTypeName: 'Regular',
  theme: 'Communication',
  cohortName: 'Summer 2026',
  programId: 'program-1',
  programName: 'Soft Skills',
  rosterMode: 'enrolled',
  startsAt: '2026-07-28T21:00:00.000Z',
  endsAt: '2026-07-28T23:30:00.000Z',
  cancelledAt: null,
  description: null,
  attendanceMarkedCount: 0,
  attendedCount: 0,
  attendanceRate: null,
  state: 'upcoming',
};

describe('AttendanceModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    api.getSessionRoster.mockResolvedValue([{
      youthId: 'youth-1',
      firstName: 'Maya',
      lastName: 'Thompson',
      status: 'present',
      notes: null,
    }]);
    api.setSessionAttendance.mockResolvedValue([]);
    api.getYouth.mockResolvedValue([]);
  });

  it('renders session context and roster failures', async () => {
    api.getSessionRoster.mockRejectedValue(new Error('Roster unavailable'));
    const openSession = { ...session, rosterMode: 'open' as const };

    render(
      <AttendanceModal
        session={openSession}
        onClose={vi.fn()}
        onSaved={vi.fn()}
      />,
    );

    expect(screen.getByRole('heading', { name: 'Attendance' })).toBeInTheDocument();
    expect(screen.getByText('Jul 28, 2026 · Communication')).toBeInTheDocument();
    expect(await screen.findByRole('alert')).toHaveTextContent('Roster unavailable');
    expect(screen.getByRole('textbox', { name: 'Find youth profile' })).toBeDisabled();
    expect(screen.getByRole('button', { name: '+ Create Profile' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Save Attendance' })).toBeDisabled();
  });

  it('keeps Youth creation visible before returning to a disabled pending attendance draft', async () => {
    const user = userEvent.setup();
    let finishSave: (value: unknown[]) => void = () => {};
    api.getSessionRoster.mockResolvedValue([]);
    api.getYouth.mockResolvedValue([{
      id: 'youth-2',
      firstName: 'Jordan',
      lastName: 'Drop In',
    }]);
    api.setSessionAttendance.mockReturnValue(new Promise(resolve => {
      finishSave = resolve;
    }));
    const openSession = { ...session, rosterMode: 'open' as const, programName: 'Drop In' };
    const onSaved = vi.fn();

    render(
      <AttendanceModal
        session={openSession}
        onClose={vi.fn()}
        onSaved={onSaved}
      />,
    );

    expect(await screen.findByText('No youth have checked in yet.')).toBeInTheDocument();
    expect(screen.queryByText('Late')).not.toBeInTheDocument();

    await user.type(screen.getByRole('textbox', { name: 'Find youth profile' }), 'Jordan');
    await user.click(await screen.findByRole('button', { name: 'Check in' }));
    expect(screen.getByText('Jordan Drop In')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: '+ Create Profile' }));
    await user.click(screen.getByRole('button', { name: 'Finish creating profile' }));
    expect(screen.queryByText('New Visitor')).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Close created profile' }));
    expect(screen.getByText('New Visitor')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Save Attendance' }));

    expect(api.setSessionAttendance).toHaveBeenCalledOnce();
    expect(screen.getByRole('textbox', { name: 'Find youth profile' })).toBeDisabled();
    expect(screen.getByRole('button', { name: '+ Create Profile' })).toBeDisabled();
    screen.getAllByRole('button', { name: 'Remove' }).forEach(button => {
      expect(button).toBeDisabled();
    });
    expect(screen.getByRole('button', { name: 'Save Attendance' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeDisabled();

    await act(async () => finishSave([]));
    expect(onSaved).toHaveBeenCalledOnce();
  });
});
