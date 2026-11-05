import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  getSessionRoster,
  getAttendanceYouth,
  setSessionAttendance,
} from '../../../sessions.api';
import { makeProgramSession } from '../../../../../../tests/factories/session';
import {
  createQueryClientWrapper,
  createTestQueryClient,
} from '../../../../../../tests/queryClientTestUtils';
import useSessionAttendanceModal from './useSessionAttendanceModal';

const SESSION_QUERY_KEY = ['sessions'] as const;

vi.mock('../../../sessions.api', () => ({
  getSessionRoster: vi.fn(),
  getAttendanceYouth: vi.fn(),
  setSessionAttendance: vi.fn(),
}));

const session = makeProgramSession({ enrollmentRequired: true, theme: 'Communication' });
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
  const hook = renderHook(() => useSessionAttendanceModal({
    session: overrides.session ?? session,
    onSaved,
  }), {
    wrapper: createQueryClientWrapper(queryClient),
  });

  return { ...hook, onSaved, queryClient };
}

describe('useSessionAttendanceModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getSessionRoster).mockResolvedValue(roster);
    vi.mocked(setSessionAttendance).mockResolvedValue({ roster, session });
    vi.mocked(getAttendanceYouth).mockResolvedValue([{ id: 'youth-2', firstName: 'Jordan', lastName: 'Lee' }]);
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
    expect(onSaved).toHaveBeenCalledWith({ roster, session });
    expect(result.current.submitStatus).toBe('success');
    expect(getAttendanceYouth).not.toHaveBeenCalled();
  });

  it('submits every checked-in youth as present for an open roster', async () => {
    vi.mocked(getSessionRoster).mockResolvedValue([]);
    const openSession = makeProgramSession({ enrollmentRequired: false, theme: 'Drop In' });
    const { result } = renderWorkflow({ session: openSession });

    await waitFor(() => expect(result.current.attendanceLoading).toBe(false));
    act(() => result.current.toggleOpenAttendee('youth-2'));
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
      .mockResolvedValueOnce({ roster, session });
    const { result } = renderWorkflow();

    await waitFor(() => expect(result.current.roster).toEqual(roster));
    await act(() => result.current.submit());

    expect(result.current.submitStatus).toBe('error');
    expect(result.current.statusMessage).toBe('Attendance unavailable');

    await act(() => result.current.submit());
    expect(setSessionAttendance).toHaveBeenCalledTimes(2);
    expect(result.current.submitStatus).toBe('success');
  });

  it('initializes checked attendance and preserves saved notes when unchecking and rechecking', async () => {
    const savedRoster = [{ ...roster[0], notes: 'Existing attendance note' }];
    vi.mocked(getSessionRoster).mockResolvedValue(savedRoster);
    const openSession = makeProgramSession({ enrollmentRequired: false });
    const { result } = renderWorkflow({ session: openSession });

    await waitFor(() => expect(result.current.attendanceLoading).toBe(false));
    expect(result.current.roster).toEqual(savedRoster);
    expect(result.current.youth.map(profile => profile.id)).toContain('youth-1');
    expect(getAttendanceYouth).toHaveBeenCalledWith(expect.objectContaining({ signal: expect.any(AbortSignal) }));

    act(() => result.current.toggleOpenAttendee('youth-1'));
    expect(result.current.roster).toEqual([]);
    act(() => result.current.toggleOpenAttendee('youth-2'));
    act(() => result.current.toggleOpenAttendee('youth-1'));
    await act(() => result.current.submit());

    expect(setSessionAttendance).toHaveBeenCalledWith(openSession.id, [
      { youthId: 'youth-2', status: 'present', notes: null },
      { youthId: 'youth-1', status: 'present', notes: 'Existing attendance note' },
    ]);
  });

  it('saves an unchecked open roster as an empty replacement', async () => {
    const openSession = makeProgramSession({ enrollmentRequired: false });
    const { result } = renderWorkflow({ session: openSession });
    await waitFor(() => expect(result.current.attendanceLoading).toBe(false));

    act(() => result.current.toggleOpenAttendee('youth-1'));
    await act(() => result.current.submit());

    expect(setSessionAttendance).toHaveBeenCalledWith(openSession.id, []);
  });

  it('blocks saving and draft changes when the youth lookup fails', async () => {
    vi.mocked(getAttendanceYouth).mockRejectedValue(new Error('Youth unavailable'));
    const openSession = makeProgramSession({ enrollmentRequired: false });
    const { result } = renderWorkflow({ session: openSession });
    await waitFor(() => expect(result.current.youthUnavailable).toBe(true));

    act(() => result.current.toggleOpenAttendee('youth-1'));
    await act(() => result.current.submit());

    expect(result.current.youthError).toBe('Youth unavailable');
    expect(result.current.roster).toEqual(roster);
    expect(setSessionAttendance).not.toHaveBeenCalled();
  });

  it('waits for the complete youth list before allowing attendance replacement', async () => {
    vi.mocked(getAttendanceYouth).mockReturnValue(new Promise(() => {}));
    const openSession = makeProgramSession({ enrollmentRequired: false });
    const { result } = renderWorkflow({ session: openSession });
    await waitFor(() => expect(result.current.roster).toEqual(roster));

    act(() => result.current.toggleOpenAttendee('youth-1'));
    await act(() => result.current.submit());

    expect(result.current.attendanceLoading).toBe(true);
    expect(result.current.roster).toEqual(roster);
    expect(setSessionAttendance).not.toHaveBeenCalled();
  });

  it('does not submit when the initial roster could not load', async () => {
    vi.mocked(getSessionRoster).mockRejectedValue(new Error('Roster unavailable'));
    const openSession = makeProgramSession({ enrollmentRequired: false });
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
    const nextSession = makeProgramSession({ id: 'session-2', theme: 'Teamwork' });
    const queryClient = createTestQueryClient();
    const view = renderHook(
      ({ target }) => useSessionAttendanceModal({ session: target, onSaved: vi.fn() }),
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

  it('initializes a different cached session even when its roster reference is unchanged', async () => {
    const firstSession = makeProgramSession({ enrollmentRequired: false });
    const nextSession = makeProgramSession({ id: 'session-2', enrollmentRequired: false });
    const queryClient = createTestQueryClient();
    queryClient.setQueryDefaults(SESSION_QUERY_KEY, { staleTime: Infinity });
    queryClient.setQueryData([...SESSION_QUERY_KEY, firstSession.id, 'roster'], roster);
    queryClient.setQueryData([...SESSION_QUERY_KEY, nextSession.id, 'roster'], roster);
    queryClient.setQueryData([...SESSION_QUERY_KEY, 'attendance-youth'], [{
      id: 'youth-1', firstName: 'Maya', lastName: 'Thompson',
    }]);
    const view = renderHook(
      ({ target }) => useSessionAttendanceModal({ session: target, onSaved: vi.fn() }),
      { initialProps: { target: firstSession }, wrapper: createQueryClientWrapper(queryClient) },
    );
    await waitFor(() => expect(view.result.current.roster).toEqual(roster));

    act(() => view.result.current.toggleOpenAttendee('youth-1'));
    expect(view.result.current.roster).toEqual([]);
    view.rerender({ target: nextSession });

    expect(view.result.current.roster).toEqual(roster);
  });
});
