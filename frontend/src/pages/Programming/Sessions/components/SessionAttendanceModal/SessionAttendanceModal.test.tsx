import { act, screen } from '@testing-library/react';
import { renderWithQueryClient as render } from '../../../../../tests/queryClientTestUtils';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { makeProgramSession } from '../../../../../tests/factories/session';
import SessionAttendanceModal from './SessionAttendanceModal';

const api = vi.hoisted(() => ({
  getSessionRoster: vi.fn(),
  setSessionAttendance: vi.fn(),
  getAttendanceYouth: vi.fn(),
}));

vi.mock('../../sessions.api', () => api);

const session = makeProgramSession({
  startsAt: '2026-07-28T21:00:00.000Z',
  endsAt: '2026-07-28T23:30:00.000Z',
});

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
    api.getAttendanceYouth.mockResolvedValue([]);
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
    expect(screen.queryByRole('searchbox')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled();
  });

  it('checks in an existing youth and locks the pending attendance draft', async () => {
    const user = userEvent.setup();
    let finishSave: (value: unknown[]) => void = () => {};
    api.getSessionRoster.mockResolvedValue([]);
    api.getAttendanceYouth.mockResolvedValue([{
      id: 'youth-2',
      firstName: 'Jordan',
      lastName: 'Drop In',
    }]);
    api.setSessionAttendance.mockReturnValue(new Promise(resolve => {
      finishSave = resolve;
    }));
    const openSession = { ...session, enrollmentRequired: false, program: 'Drop In' };
    const onSaved = vi.fn();

    render(
      <SessionAttendanceModal
        session={openSession}
        onClose={vi.fn()}
        onSaved={onSaved}
      />,
    );

    expect(await screen.findByRole('checkbox', { name: 'Jordan Drop In' })).not.toBeChecked();
    expect(screen.queryByText('Late')).not.toBeInTheDocument();

    await user.click(screen.getByRole('checkbox', { name: 'Jordan Drop In' }));
    expect(screen.getByText('Jordan Drop In')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Save' }));

    expect(api.setSessionAttendance).toHaveBeenCalledOnce();
    expect(screen.getByRole('searchbox', { name: 'Search Youth attendance' })).toBeDisabled();
    expect(screen.getByRole('checkbox', { name: 'Jordan Drop In' })).toBeDisabled();
    expect(api.getAttendanceYouth).toHaveBeenCalledOnce();
    expect(api.setSessionAttendance).toHaveBeenCalledWith('session-1', [{ youthId: 'youth-2', status: 'present', notes: null }]);
    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeDisabled();

    await act(async () => finishSave([]));
    expect(onSaved).toHaveBeenCalledOnce();
  });

  it('searches all youth locally and saves only the checked choices', async () => {
    const user = userEvent.setup();
    const youth = Array.from({ length: 60 }, (_, index) => ({
      id: `youth-${index + 1}`,
      firstName: 'Person',
      lastName: String(index + 1).padStart(2, '0'),
    }));
    api.getAttendanceYouth.mockResolvedValue(youth);
    api.getSessionRoster.mockResolvedValue([{
      youthId: 'youth-1', firstName: 'Person', lastName: '01', status: 'present', notes: null,
    }]);
    render(<SessionAttendanceModal session={{ ...session, enrollmentRequired: false }}
      onClose={vi.fn()} onSaved={vi.fn()} />);
    expect(await screen.findByRole('checkbox', { name: 'Person 01' })).toBeChecked();
    expect(screen.getAllByRole('checkbox')).toHaveLength(25);

    await user.click(screen.getByRole('checkbox', { name: 'Person 01' }));
    await user.type(screen.getByRole('searchbox'), 'Person 60');
    await user.click(screen.getByRole('checkbox', { name: 'Person 60' }));
    await user.clear(screen.getByRole('searchbox'));
    await user.click(screen.getByRole('button', { name: 'Save' }));

    expect(api.getAttendanceYouth).toHaveBeenCalledOnce();
    expect(api.setSessionAttendance).toHaveBeenCalledWith('session-1', [
      { youthId: 'youth-60', status: 'present', notes: null },
    ]);
  });

  it('shows a youth lookup failure and prevents saving incomplete attendance', async () => {
    api.getAttendanceYouth.mockRejectedValue(new Error('Youth unavailable'));
    render(<SessionAttendanceModal session={{ ...session, enrollmentRequired: false }}
      onClose={vi.fn()} onSaved={vi.fn()} />);

    expect(await screen.findByRole('alert')).toHaveTextContent('Youth unavailable');
    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled();
    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();
    expect(screen.queryByText('No youth profiles available.')).not.toBeInTheDocument();
  });
});
