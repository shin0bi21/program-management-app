import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { CohortSession } from '../../../common/types/cohort';
import AttendanceModal from './AttendanceModal';

const api = vi.hoisted(() => ({
  getSessionRoster: vi.fn(),
  saveSessionAttendance: vi.fn(),
  getYouth: vi.fn(),
}));

vi.mock('../../../common/api/cohorts.api', () => api);
vi.mock('../../../common/api/youth.api', () => ({ getYouth: api.getYouth }));
vi.mock('../../Youth/components/YouthModal/YouthModal', () => ({
  default: ({
    isOpen,
    onSuccess,
  }: {
    isOpen: boolean;
    onSuccess: (profile: { id: string; firstName: string; lastName: string }) => void;
  }) => isOpen ? (
    <button
      type="button"
      onClick={() => onSuccess({ id: 'youth-new', firstName: 'New', lastName: 'Visitor' })}
    >
      Finish creating profile
    </button>
  ) : null,
}));

const session: CohortSession = {
  id: 'session-1',
  cohortId: 'cohort-1',
  theme: 'Communication',
  cohortName: 'Summer 2026',
  programId: 'program-1',
  programName: 'Soft Skills',
  rosterMode: 'enrolled',
  startsAt: '2026-07-28T21:00:00.000Z',
  endsAt: '2026-07-28T23:30:00.000Z',
  cancelledAt: null,
  description: null,
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
    api.saveSessionAttendance.mockResolvedValue([]);
    api.getYouth.mockResolvedValue([]);
  });

  it('shows saving and success feedback before closing', async () => {
    const user = userEvent.setup();
    let finishSave: (value: unknown[]) => void = () => {};
    api.saveSessionAttendance.mockReturnValue(new Promise(resolve => {
      finishSave = resolve;
    }));
    const onSaved = vi.fn().mockResolvedValue(undefined);

    render(
      <AttendanceModal
        session={session}
        onClose={vi.fn()}
        onSaved={onSaved}
      />,
    );

    await screen.findByText('Maya Thompson');
    await user.click(screen.getByRole('button', { name: 'Save Attendance' }));

    expect(screen.getByText('Saving attendance for Communication...')).toBeInTheDocument();
    finishSave([]);

    expect(await screen.findByText(
      'Attendance successfully saved for Communication.',
    )).toBeInTheDocument();
    expect(onSaved).toHaveBeenCalledOnce();
  });

  it('searches, creates, and checks profiles into an open session without statuses', async () => {
    const user = userEvent.setup();
    api.getSessionRoster.mockResolvedValue([]);
    api.getYouth.mockResolvedValue([{
      id: 'youth-2',
      firstName: 'Jordan',
      lastName: 'Drop In',
    }]);
    const openSession = { ...session, rosterMode: 'open' as const, programName: 'Drop In' };

    render(
      <AttendanceModal
        session={openSession}
        onClose={vi.fn()}
        onSaved={vi.fn()}
      />,
    );

    expect(await screen.findByText('No youth have checked in yet.')).toBeInTheDocument();
    expect(screen.queryByText('Late')).not.toBeInTheDocument();

    await user.type(screen.getByRole('textbox', { name: 'Find youth profile' }), 'Jordan');
    await user.click(await screen.findByRole('button', { name: 'Check in' }));
    expect(screen.getByText('Jordan Drop In')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: '+ Create Profile' }));
    await user.click(screen.getByRole('button', { name: 'Finish creating profile' }));
    expect(screen.getByText('New Visitor')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Save Attendance' }));
    expect(api.saveSessionAttendance).toHaveBeenCalledWith('session-1', [
      expect.objectContaining({ youthId: 'youth-2', status: 'present' }),
      expect.objectContaining({ youthId: 'youth-new', status: 'present' }),
    ]);
  });
});
