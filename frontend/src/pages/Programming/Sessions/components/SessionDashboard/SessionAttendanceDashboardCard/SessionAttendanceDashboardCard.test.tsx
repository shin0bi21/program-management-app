import { act, fireEvent, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { makeProgramSession } from '../../../../../../tests/factories/session';
import { renderWithQueryClient as render } from '../../../../../../tests/queryClientTestUtils';
import { getSessionRoster } from '../../../sessions.api';
import type { SessionRosterMember } from '../../../types';
import SessionAttendanceDashboardCard from './SessionAttendanceDashboardCard';

vi.mock('../../../sessions.api', () => ({ getSessionRoster: vi.fn() }));

const session = makeProgramSession();
const roster: SessionRosterMember[] = (['present', 'present', 'present', 'late', 'absent', null] as const).map((status, index) => ({
  youthId: `youth-${index}`, firstName: 'Alex', lastName: 'Lee',
  status, notes: null,
}));

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getSessionRoster).mockResolvedValue(roster);
});

describe('SessionAttendanceDashboardCard', () => {
  it('shows an unselected state without loading attendance and disables management', () => {
    render(<SessionAttendanceDashboardCard session={null} canWrite onManage={vi.fn()} />);

    expect(screen.getByText('No session selected.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Manage attendance' })).toBeDisabled();
    expect(getSessionRoster).not.toHaveBeenCalled();
  });

  it('summarizes marked roster statuses and delegates management', async () => {
    const onManage = vi.fn();
    render(<SessionAttendanceDashboardCard session={session} canWrite onManage={onManage} />);

    expect(await screen.findByText('4/5')).toBeInTheDocument();
    expect(getSessionRoster).toHaveBeenCalledWith(session.id, { signal: expect.any(AbortSignal) });
    fireEvent.click(screen.getByRole('button', { name: 'Manage attendance' }));
    expect(onManage).toHaveBeenCalledWith(session);
  });

  it('uses check-in language for open sessions', async () => {
    vi.mocked(getSessionRoster).mockResolvedValue(roster.slice(0, 5).map(member => ({ ...member, status: 'present' })));
    render(<SessionAttendanceDashboardCard session={{ ...session, enrollmentRequired: false }} canWrite={false} onManage={vi.fn()} />);

    expect(await screen.findByText('5 check-ins')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Manage attendance' })).not.toBeInTheDocument();
  });

  it('shows an empty state when nobody has a recorded status', async () => {
    vi.mocked(getSessionRoster).mockResolvedValue(roster.map(member => ({ ...member, status: null })));
    render(<SessionAttendanceDashboardCard session={session} canWrite onManage={vi.fn()} />);

    expect(await screen.findByText('No attendance.')).toBeInTheDocument();
  });

  it('shows recorded attendance even when nobody attended', async () => {
    vi.mocked(getSessionRoster).mockResolvedValue(roster.slice(0, 5).map(member => ({ ...member, status: 'absent' })));
    render(<SessionAttendanceDashboardCard session={session} canWrite onManage={vi.fn()} />);

    expect(await screen.findByText('0/5')).toBeInTheDocument();
  });

  it('keeps failures distinct from empty attendance and supports retry', async () => {
    vi.mocked(getSessionRoster).mockRejectedValueOnce(new Error('Unavailable')).mockResolvedValueOnce([]);
    render(<SessionAttendanceDashboardCard session={session} canWrite onManage={vi.fn()} />);

    expect(await screen.findByText('Session attendance unavailable')).toBeInTheDocument();
    expect(screen.queryByText('No attendance.')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
    expect(await screen.findByText('No attendance.')).toBeInTheDocument();
  });

  it('updates from the same roster cache populated by attendance saves', async () => {
    const { queryClient } = render(<SessionAttendanceDashboardCard session={session} canWrite onManage={vi.fn()} />);
    expect(await screen.findByText('4/5')).toBeInTheDocument();

    act(() => queryClient.setQueryData(['sessions', session.id, 'roster'], [roster[0]]));

    expect(await screen.findByText('1/1')).toBeInTheDocument();
    expect(getSessionRoster).toHaveBeenCalledOnce();
  });
});
