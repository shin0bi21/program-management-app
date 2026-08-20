// Owns attendance initialization, draft preservation, commands, target reset, and refresh outcomes.
import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  getSessionRoster,
  setSessionAttendance,
} from '../../../../../../common/features/programming/api/sessions.api';
import { SESSION_QUERY_KEY } from '../../../../../../common/features/programming/queryKeys';
import { getYouth } from '../../../../../../common/features/youth/youth.api';
import { makeCohortSession } from '../../../../../../tests/factories/session';
import {
  createQueryClientWrapper,
  createTestQueryClient,
} from '../../../../../../tests/queryClientTestUtils';
import useAttendanceModal from './useAttendanceModal';

vi.mock('../../../../../../common/features/programming/api/sessions.api', () => ({
  getSessionRoster: vi.fn(),
  setSessionAttendance: vi.fn(),
}));
vi.mock('../../../../../../common/features/youth/youth.api', () => ({ getYouth: vi.fn() }));

const session = makeCohortSession({ rosterMode: 'enrolled', theme: 'Communication' });
const roster = [{
  youthId: 'youth-1',
  firstName: 'Maya',
  lastName: 'Thompson',
  status: 'present' as const,
  notes: null,
}];

function renderWorkflow(overrides: {
  session?: typeof session;
  onSaved?: () => void | Promise<void>;
} = {}) {
  const onSaved = overrides.onSaved ?? vi.fn();
  const queryClient = createTestQueryClient();
  const hook = renderHook(() => useAttendanceModal({
    session: overrides.session ?? session,
    onSaved,
  }), {
    wrapper: createQueryClientWrapper(queryClient),
  });

  return { ...hook, onSaved, queryClient };
}

describe('useAttendanceModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getSessionRoster).mockResolvedValue(roster);
    vi.mocked(setSessionAttendance).mockResolvedValue([]);
    vi.mocked(getYouth).mockResolvedValue([]);
  });

  it('initializes enrolled attendance and submits only marked youth', async () => {
    const { result, onSaved } = renderWorkflow();

    await waitFor(() => expect(result.current.roster).toEqual(roster));
    act(() => result.current.updateAttendanceStatus('youth-1', 'late'));
    await act(() => result.current.submit());

    expect(setSessionAttendance).toHaveBeenCalledWith(session.id, [{
      youthId: 'youth-1',
      status: 'late',
      notes: null,
    }]);
    expect(onSaved).toHaveBeenCalledOnce();
    expect(result.current.submitStatus).toBe('success');
  });

  it('submits every checked-in youth as present for an open roster', async () => {
    vi.mocked(getSessionRoster).mockResolvedValue([]);
    const openSession = makeCohortSession({ rosterMode: 'open', theme: 'Drop In' });
    const { result } = renderWorkflow({ session: openSession });

    await waitFor(() => expect(result.current.rosterLoading).toBe(false));
    act(() => result.current.addOpenAttendee({
      id: 'youth-2',
      firstName: 'Jordan',
      lastName: 'Lee',
    }));
    await act(() => result.current.submit());

    expect(setSessionAttendance).toHaveBeenCalledWith(openSession.id, [{
      youthId: 'youth-2',
      status: 'present',
      notes: null,
    }]);
  });

  it('surfaces a failed attendance command and permits retry', async () => {
    vi.mocked(setSessionAttendance)
      .mockRejectedValueOnce(new Error('Attendance unavailable'))
      .mockResolvedValueOnce([]);
    const { result } = renderWorkflow();

    await waitFor(() => expect(result.current.roster).toEqual(roster));
    await act(() => result.current.submit());

    expect(result.current.submitStatus).toBe('error');
    expect(result.current.statusMessage).toBe('Attendance unavailable');

    await act(() => result.current.submit());
    expect(setSessionAttendance).toHaveBeenCalledTimes(2);
    expect(result.current.submitStatus).toBe('success');
  });

  it('does not submit when the initial roster could not load', async () => {
    vi.mocked(getSessionRoster).mockRejectedValue(new Error('Roster unavailable'));
    const openSession = makeCohortSession({ rosterMode: 'open' });
    const { result } = renderWorkflow({ session: openSession });

    await waitFor(() => expect(result.current.rosterUnavailable).toBe(true));
    await act(() => result.current.submit());

    expect(setSessionAttendance).not.toHaveBeenCalled();
  });

  it('preserves locally edited attendance when roster data refreshes', async () => {
    const { result, queryClient } = renderWorkflow();

    await waitFor(() => expect(result.current.roster).toEqual(roster));
    act(() => result.current.updateAttendanceStatus('youth-1', 'late'));
    act(() => {
      queryClient.setQueryData(
        [...SESSION_QUERY_KEY, session.id, 'roster'],
        [{ ...roster[0], status: 'absent' }],
      );
    });

    expect(result.current.selections['youth-1']).toBe('late');
    expect(result.current.roster).toEqual(roster);
  });

  it('keeps saved attendance successful and non-retryable when refresh fails', async () => {
    const { result } = renderWorkflow({
      onSaved: vi.fn().mockRejectedValue(new Error('Refresh failed')),
    });
    await waitFor(() => expect(result.current.roster).toEqual(roster));

    await act(() => result.current.submit());

    expect(setSessionAttendance).toHaveBeenCalledOnce();
    expect(result.current.submitStatus).toBe('success');
    expect(result.current.statusMessage).toContain('Reload to see it');

    await act(() => result.current.submit());
    expect(setSessionAttendance).toHaveBeenCalledOnce();
  });

  it('starts a different session with its own roster draft', async () => {
    const nextSession = makeCohortSession({ id: 'session-2', theme: 'Teamwork' });
    const queryClient = createTestQueryClient();
    const view = renderHook(
      ({ target }) => useAttendanceModal({ session: target, onSaved: vi.fn() }),
      {
        initialProps: { target: session },
        wrapper: createQueryClientWrapper(queryClient),
      },
    );
    await waitFor(() => expect(view.result.current.roster).toEqual(roster));
    act(() => view.result.current.updateAttendanceStatus('youth-1', 'late'));

    view.rerender({ target: nextSession });

    await waitFor(() => expect(getSessionRoster).toHaveBeenLastCalledWith(
      nextSession.id,
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    ));
    await waitFor(() => expect(view.result.current.selections['youth-1']).toBe('present'));
  });
});
