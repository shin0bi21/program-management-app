import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { makeCohortRosterYouth } from '../../../../../tests/factories/cohortRoster';
import { renderWithQueryClient as render } from '../../../../../tests/queryClientTestUtils';
import ManageRosterModal from './ManageRosterModal';

const api = vi.hoisted(() => ({ getCohortRosterYouth: vi.fn(), withdrawYouth: vi.fn(), enrollYouth: vi.fn() }));
vi.mock('../../cohorts.api', () => ({
  withdrawYouth: api.withdrawYouth,
  enrollYouth: api.enrollYouth,
  getCohortRosterYouth: api.getCohortRosterYouth,
}));

describe('ManageRosterModal', () => {
  const cohort = {
    id: 'cohort-1', programId: 'program-1', programName: 'Soft Skills', enrollmentRequired: true,
    minAge: 12, maxAge: 15, cycleId: 'cycle-summer-2026', cycleName: 'Summer 2026',
    name: 'Summer 2026', startsOn: '2026-06-30', endsOn: '2026-08-31', state: 'active' as const,
    enrolledCount: 1, nextSessionAt: null, nextSessionId: null, averageAttendance: null,
    attendanceAttendedCount: 0, attendanceRecordedCount: 0, uniqueAttendeeCount: 0,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    api.getCohortRosterYouth.mockResolvedValue([
      makeCohortRosterYouth({
        id: 'youth-1', firstName: 'Already', lastName: 'Enrolled', dateOfBirth: '2012-01-01', age: 14,
        schoolName: null, cohorts: [{ id: cohort.id, withdrawnOn: null }],
      }),
      makeCohortRosterYouth({ id: 'youth-2', firstName: 'Not', lastName: 'Enrolled', dateOfBirth: '2010-01-01', age: 15, schoolName: 'Central School' }),
    ]);
    api.enrollYouth.mockResolvedValue({});
    api.withdrawYouth.mockResolvedValue({});
  });

  it('shows all youth in one checklist and enrolls an unchecked youth', async () => {
    const user = userEvent.setup();
    const onSuccess = vi.fn().mockResolvedValue(undefined);
    render(<ManageRosterModal cohort={cohort} onClose={vi.fn()} onSuccess={onSuccess} />);

    expect(screen.getByRole('heading', { name: 'Soft Skills - Summer 2026 Roster' })).toBeInTheDocument();
    const enrolled = await screen.findByRole('checkbox', { name: /Already Enrolled/ });
    const available = screen.getByRole('checkbox', { name: /Not Enrolled/ });
    expect(enrolled).toBeChecked();
    expect(available).not.toBeChecked();
    expect(screen.getByText(/Central School/)).toBeInTheDocument();

    await user.click(available);

    await waitFor(() => expect(api.enrollYouth).toHaveBeenCalledWith('cohort-1', { youthIds: ['youth-2'] }));
    expect(onSuccess).toHaveBeenCalledOnce();
  });

  it('shows backend-owned age bounds and searches the eligible youth list', async () => {
    const user = userEvent.setup();
    render(<ManageRosterModal cohort={cohort} onClose={vi.fn()} onSuccess={vi.fn()} />);

    await screen.findByRole('checkbox', { name: /Already Enrolled/ });
    expect(screen.getByRole('spinbutton', { name: 'Minimum age' })).toHaveValue(12);
    expect(screen.getByRole('spinbutton', { name: 'Minimum age' })).toBeDisabled();
    expect(screen.getByRole('spinbutton', { name: 'Maximum age' })).toHaveValue(15);
    expect(screen.getByRole('spinbutton', { name: 'Maximum age' })).toBeDisabled();

    await user.type(screen.getByRole('textbox', { name: 'Search youth' }), 'central');
    await user.keyboard('{Enter}');
    expect(screen.queryByRole('checkbox', { name: /Already Enrolled/ })).not.toBeInTheDocument();
    expect(screen.getByRole('checkbox', { name: /Not Enrolled/ })).toBeInTheDocument();

    await user.clear(screen.getByRole('textbox', { name: 'Search youth' }));
    await user.keyboard('{Enter}');
    expect(screen.getByRole('checkbox', { name: /Already Enrolled/ })).toBeInTheDocument();
    expect(screen.getByRole('checkbox', { name: /Not Enrolled/ })).toBeInTheDocument();
  });

  it('confirms withdrawal from the same checklist and preserves attendance history', async () => {
    const user = userEvent.setup();
    const onSuccess = vi.fn().mockResolvedValue(undefined);
    render(<ManageRosterModal cohort={cohort} onClose={vi.fn()} onSuccess={onSuccess} />);

    await user.click(await screen.findByRole('checkbox', { name: /Already Enrolled/ }));
    const confirmation = screen.getByRole('heading', { name: 'Withdraw Youth' }).closest('.modal-container');
    expect(confirmation).toHaveTextContent('Their existing attendance history will be kept.');
    expect(screen.getAllByRole('dialog')).toHaveLength(1);

    await user.click(within(confirmation as HTMLElement).getByRole('button', { name: 'Withdraw' }));
    await waitFor(() => expect(api.withdrawYouth).toHaveBeenCalledWith('cohort-1', 'youth-1'));
    expect(onSuccess).toHaveBeenCalledOnce();
  });

  it('shows roster loading failures as accessible errors', async () => {
    api.getCohortRosterYouth.mockRejectedValue(new Error('roster unavailable'));

    render(<ManageRosterModal cohort={cohort} onClose={vi.fn()} onSuccess={vi.fn()} />);

    expect(await screen.findByRole('alert')).toHaveTextContent('roster unavailable');
    expect(screen.queryByText('No eligible youth found.')).not.toBeInTheDocument();
  });
});
