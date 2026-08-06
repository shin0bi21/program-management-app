import { screen, waitFor, within } from '@testing-library/react';
import render from '../../../../../tests/renderWithQueryClient';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { makeYouthProfile } from '../../../../../tests/factories/youth';
import WithdrawYouthModal from './WithdrawYouthModal';

const api = vi.hoisted(() => ({
  getYouth: vi.fn(),
  withdrawYouth: vi.fn(),
}));

vi.mock('../../../../../common/api/cohorts.api', () => ({
  withdrawYouth: api.withdrawYouth,
}));
vi.mock('../../../../../common/api/youth.api', () => ({
  getYouth: api.getYouth,
}));

describe('WithdrawYouthModal', () => {
  const cohort = {
    id: 'cohort-1',
    programId: 'program-1',
    programName: 'Soft Skills',
    rosterMode: 'enrolled' as const,
    minAge: 12,
    maxAge: 15,
    name: 'Summer 2026',
    startsOn: '2026-06-30',
    endsOn: '2026-08-31',
    state: 'active' as const,
    enrolledCount: 1,
    nextSessionAt: null,
    nextSessionId: null,
    averageAttendance: null,
    attendanceAttendedCount: 0,
    attendanceRecordedCount: 0,
    uniqueAttendeeCount: 0,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    api.getYouth.mockResolvedValue([
      makeYouthProfile({
        id: 'youth-1',
        firstName: 'Already',
        lastName: 'Enrolled',
        cohorts: [{
          id: cohort.id,
          name: cohort.name,
          programId: cohort.programId,
          programName: cohort.programName,
          rosterMode: cohort.rosterMode,
          startsOn: cohort.startsOn,
          endsOn: cohort.endsOn,
          enrolledOn: cohort.startsOn,
          withdrawnOn: null,
          presentCount: 0,
          lateCount: 0,
          absentCount: 0,
          lastAttendedOn: null,
        }],
      }),
      makeYouthProfile({
        id: 'youth-2',
        firstName: 'Not',
        lastName: 'Enrolled',
      }),
    ]);
    api.withdrawYouth.mockResolvedValue({});
  });

  it('lists enrolled youth and withdraws with confirmation', async () => {
    const user = userEvent.setup();
    const onSuccess = vi.fn().mockResolvedValue(undefined);
    render(
      <WithdrawYouthModal
        cohort={cohort}
        onClose={vi.fn()}
        onSuccess={onSuccess}
      />,
    );

    expect(screen.getByRole('heading', {
      name: 'Soft Skills - Summer 2026 Withdrawal',
    })).toBeInTheDocument();
    expect(await screen.findByText('Already Enrolled')).toBeInTheDocument();
    expect(screen.queryByText('Not Enrolled')).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Withdraw' }));

    const confirmationModal = screen
      .getByRole('heading', { name: 'Withdraw Youth' })
      .closest('.modal-container');
    expect(confirmationModal).not.toBeNull();
    expect(confirmationModal).toHaveTextContent(
      'Their existing attendance history will be kept.',
    );
    await user.click(within(confirmationModal as HTMLElement).getByRole('button', {
      name: 'Withdraw',
    }));

    await waitFor(() => {
      expect(api.withdrawYouth).toHaveBeenCalledWith('cohort-1', 'youth-1');
      expect(onSuccess).toHaveBeenCalledOnce();
    });
    expect(await screen.findByText('Already Enrolled successfully withdrawn.')).toBeInTheDocument();
  });
});
