// Owns roster presentation and the nested enroll/withdraw modal lifecycle.
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { makeYouthProfile } from '../../../../../tests/factories/youth';
import { renderWithQueryClient as render } from '../../../../../tests/queryClientTestUtils';
import ManageRosterModal from './ManageRosterModal';

const api = vi.hoisted(() => ({ getYouth: vi.fn(), withdrawYouth: vi.fn(), enrollYouth: vi.fn() }));
vi.mock('../../../../../common/features/programming/api/cohorts.api', () => ({ withdrawYouth: api.withdrawYouth, enrollYouth: api.enrollYouth }));
vi.mock('../../../../../common/features/youth/youth.api', () => ({ getYouth: api.getYouth }));

describe('ManageRosterModal', () => {
  const cohort = {
    id: 'cohort-1', programId: 'program-1', programName: 'Soft Skills', rosterMode: 'enrolled' as const,
    minAge: 12, maxAge: 15, cycleId: 'cycle-summer-2026', cycleName: 'Summer 2026',
    name: 'Summer 2026', startsOn: '2026-06-30', endsOn: '2026-08-31', state: 'active' as const,
    enrolledCount: 1, nextSessionAt: null, nextSessionId: null, averageAttendance: null,
    attendanceAttendedCount: 0, attendanceRecordedCount: 0, uniqueAttendeeCount: 0,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    api.getYouth.mockResolvedValue([
      makeYouthProfile({ id: 'youth-1', firstName: 'Already', lastName: 'Enrolled', cohorts: [{ id: cohort.id, name: cohort.name, programId: cohort.programId, programName: cohort.programName, rosterMode: cohort.rosterMode, startsOn: cohort.startsOn, endsOn: cohort.endsOn, enrolledOn: cohort.startsOn, withdrawnOn: null, presentCount: 0, lateCount: 0, absentCount: 0, lastAttendedOn: null }] }),
      makeYouthProfile({ id: 'youth-2', firstName: 'Not', lastName: 'Enrolled', dateOfBirth: '2012-01-01' }),
    ]);
    api.withdrawYouth.mockResolvedValue({});
  });

  it('shows the current roster and withdraws while preserving attendance history', async () => {
    const user = userEvent.setup();
    const onSuccess = vi.fn().mockResolvedValue(undefined);
    render(<ManageRosterModal cohort={cohort} onClose={vi.fn()} onSuccess={onSuccess} />);

    expect(screen.getByRole('heading', { name: 'Soft Skills - Summer 2026 Roster' })).toBeInTheDocument();
    expect(await screen.findByText('Already Enrolled')).toBeInTheDocument();
    expect(screen.queryByText('Not Enrolled')).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Withdraw' }));
    const confirmation = screen.getByRole('heading', { name: 'Withdraw Youth' }).closest('.modal-container');
    expect(confirmation).toHaveTextContent('Their existing attendance history will be kept.');
    expect(screen.getAllByRole('dialog')).toHaveLength(1);

    await user.click(within(confirmation as HTMLElement).getByRole('button', { name: 'Withdraw' }));
    await waitFor(() => expect(api.withdrawYouth).toHaveBeenCalledWith('cohort-1', 'youth-1'));
    expect(onSuccess).toHaveBeenCalledOnce();
  });

  it('opens the existing enrollment flow from Add Youth', async () => {
    const user = userEvent.setup();
    render(<ManageRosterModal cohort={cohort} onClose={vi.fn()} onSuccess={vi.fn()} />);
    await user.click(screen.getByRole('button', { name: 'Add Youth' }));
    expect(screen.getByRole('heading', { name: 'Soft Skills - Summer 2026 Enrollment' })).toBeInTheDocument();
  });

  it('resets the nested flow when the roster target changes', async () => {
    const user = userEvent.setup();
    const view = render(<ManageRosterModal cohort={cohort} onClose={vi.fn()} onSuccess={vi.fn()} />);
    await user.click(screen.getByRole('button', { name: 'Add Youth' }));

    view.rerender(
      <ManageRosterModal
        cohort={{ ...cohort, id: 'cohort-2', name: 'Fall 2026' }}
        onClose={vi.fn()}
        onSuccess={vi.fn()}
      />,
    );

    expect(await screen.findByRole('heading', { name: 'Soft Skills - Fall 2026 Roster' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: /Enrollment/ })).not.toBeInTheDocument();
  });

  it('does not make a completed withdrawal retryable when roster refresh fails', async () => {
    const user = userEvent.setup();
    render(
      <ManageRosterModal
        cohort={cohort}
        onClose={vi.fn()}
        onSuccess={vi.fn().mockRejectedValue(new Error('Refresh failed'))}
      />,
    );

    await user.click(await screen.findByRole('button', { name: 'Withdraw' }));
    await user.click(screen.getByRole('button', { name: 'Withdraw' }));

    expect(await screen.findByText('Already Enrolled successfully withdrawn.')).toBeInTheDocument();
    expect(api.withdrawYouth).toHaveBeenCalledOnce();
    expect(screen.queryByText('Action failed')).not.toBeInTheDocument();
  });

  it('shows roster loading failures as accessible errors', async () => {
    api.getYouth.mockRejectedValue(new Error('roster unavailable'));

    render(<ManageRosterModal cohort={cohort} onClose={vi.fn()} onSuccess={vi.fn()} />);

    expect(await screen.findByRole('alert')).toHaveTextContent('roster unavailable');
  });
});
