import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { makeProgramRosterYouth } from '../../../../../tests/factories/programRoster';
import { renderWithQueryClient as render } from '../../../../../tests/queryClientTestUtils';
import ManageRosterModal from './ManageRosterModal';

const api = vi.hoisted(() => ({ getProgramRosterYouth: vi.fn(), setProgramRoster: vi.fn() }));
vi.mock('../../api/programCycleAssignments.api', () => ({
  setProgramRoster: api.setProgramRoster,
  getProgramRosterYouth: api.getProgramRosterYouth,
}));

describe('ManageRosterModal', () => {
  const assignment = {
    programId: 'program-1', program: 'Soft Skills', enrollmentRequired: true,
    minAge: 12, maxAge: 15, cycleId: 'cycle-summer-2026', cycle: 'Summer 2026',
    startsOn: '2026-06-30', endsOn: '2026-08-31', state: 'active' as const,
    enrolledCount: 1,
    uniqueAttendeeCount: 0,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    api.getProgramRosterYouth.mockResolvedValue([
      makeProgramRosterYouth({
        id: 'youth-1', firstName: 'Already', lastName: 'Enrolled', dateOfBirth: '2012-01-01', age: 14,
        schoolName: null, programCycles: [{ programId: assignment.programId, cycleId: assignment.cycleId, withdrawnOn: null }],
      }),
      makeProgramRosterYouth({ id: 'youth-2', firstName: 'Not', lastName: 'Enrolled', dateOfBirth: '2010-01-01', age: 15, schoolName: 'Central School' }),
    ]);
    api.setProgramRoster.mockResolvedValue({ programCycle: assignment, updatedYouth: [] });
  });

  it('edits checkbox payloads locally and saves the complete selected roster', async () => {
    const user = userEvent.setup();
    const onSuccess = vi.fn().mockResolvedValue(undefined);
    render(<ManageRosterModal assignment={assignment} onClose={vi.fn()} onSuccess={onSuccess} />);

    expect(screen.getByRole('heading', { name: 'Soft Skills - Summer 2026 Roster' })).toBeInTheDocument();
    const enrolled = await screen.findByRole('checkbox', { name: /Already Enrolled/ });
    const available = screen.getByRole('checkbox', { name: /Not Enrolled/ });
    expect(enrolled).toBeChecked();
    expect(available).not.toBeChecked();
    expect(screen.getByText(/Central School/)).toBeInTheDocument();

    await user.click(available);

    expect(available).toBeChecked();
    expect(api.setProgramRoster).not.toHaveBeenCalled();
    await user.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => expect(api.setProgramRoster).toHaveBeenCalledExactlyOnceWith(assignment, { youthIds: ['youth-1', 'youth-2'] }));
    expect(onSuccess).toHaveBeenCalledOnce();
  });

  it('shows backend-owned age bounds and searches the eligible youth list', async () => {
    const user = userEvent.setup();
    render(<ManageRosterModal assignment={assignment} onClose={vi.fn()} onSuccess={vi.fn()} />);

    await screen.findByRole('checkbox', { name: /Already Enrolled/ });
    expect(screen.getByRole('spinbutton', { name: 'Minimum age' })).toHaveValue(12);
    expect(screen.getByRole('spinbutton', { name: 'Minimum age' })).toBeDisabled();
    expect(screen.getByRole('spinbutton', { name: 'Maximum age' })).toHaveValue(15);
    expect(screen.getByRole('spinbutton', { name: 'Maximum age' })).toBeDisabled();

    await user.type(screen.getByRole('textbox', { name: 'Search youth' }), 'central');
    await user.keyboard('{Enter}');
    expect(screen.queryByRole('checkbox', { name: /Already Enrolled/ })).not.toBeInTheDocument();
    expect(screen.getByRole('checkbox', { name: /Not Enrolled/ })).toBeInTheDocument();
  });

  it('submits withdrawal only on Save', async () => {
    const user = userEvent.setup();
    render(<ManageRosterModal assignment={assignment} onClose={vi.fn()} onSuccess={vi.fn()} />);
    const member = await screen.findByRole('checkbox', { name: /Already Enrolled/ });
    await user.click(member);

    expect(member).not.toBeChecked();
    expect(screen.getAllByRole('dialog')).toHaveLength(1);
    expect(api.setProgramRoster).not.toHaveBeenCalled();

    await user.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(api.setProgramRoster).toHaveBeenCalledExactlyOnceWith(assignment, { youthIds: [] }));
  });

  it('discards checkbox changes on Cancel without sending a request', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    const props = { assignment, onClose, onSuccess: vi.fn() };
    const view = render(<ManageRosterModal {...props} />);
    await user.click(await screen.findByRole('checkbox', { name: /Already Enrolled/ }));
    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(onClose).toHaveBeenCalledOnce();
    expect(api.setProgramRoster).not.toHaveBeenCalled();

    view.rerender(<ManageRosterModal {...props} assignment={null} />);
    view.rerender(<ManageRosterModal {...props} />);
    expect(await screen.findByRole('checkbox', { name: /Already Enrolled/ })).toBeChecked();
  });

  it('shows roster loading failures as accessible errors', async () => {
    api.getProgramRosterYouth.mockRejectedValue(new Error('roster unavailable'));

    render(<ManageRosterModal assignment={assignment} onClose={vi.fn()} onSuccess={vi.fn()} />);

    expect(await screen.findByRole('alert')).toHaveTextContent('roster unavailable');
    expect(screen.queryByText('No eligible youth found.')).not.toBeInTheDocument();
  });
});
