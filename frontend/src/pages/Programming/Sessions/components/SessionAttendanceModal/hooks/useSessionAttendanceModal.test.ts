import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  getAttendanceYouth,
  setSessionAttendance,
} from '../../../sessions.api';
import { makeProgramSession } from '../../../../../../tests/factories/session';
import {
  createQueryClientWrapper,
  createTestQueryClient,
} from '../../../../../../tests/queryClientTestUtils';
import useSessionAttendanceModal from './useSessionAttendanceModal';
import type { SessionRosterMember } from '../../../types';

const SESSION_QUERY_KEY = ['sessions'] as const;

vi.mock('../../../sessions.api', () => ({
  getAttendanceYouth: vi.fn(),
  setSessionAttendance: vi.fn(),
}));

const session = makeProgramSession({ enrollmentRequired: true, title: 'Communication' });
const roster = [{
  youthId: 'youth-1',
  firstName: 'Maya',
  lastName: 'Thompson',
  status: 'present' as const,
  notes: null,
}];

/**
 * Mounts an attendance draft with supplied session and roster values.
 * @param overrides - Saved attendance and callbacks for this domain scenario.
 * @example renderWorkflow({ roster: [] }) // new open-session check-ins
 */
function renderWorkflow(overrides: {
  session?: typeof session;
  roster?: SessionRosterMember[];
  onSaved?: () => void | Promise<void>;
} = {}) {
  const onSaved = overrides.onSaved ?? vi.fn();
  const queryClient = createTestQueryClient();
  const hook = renderHook(() => useSessionAttendanceModal({
    session: overrides.session ?? session,
    roster: overrides.roster ?? roster,
    onSaved,
  }), {
    wrapper: createQueryClientWrapper(queryClient),
  });

  return { ...hook, onSaved, queryClient };
}

describe('useSessionAttendanceModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
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
    const openSession = makeProgramSession({ enrollmentRequired: false, title: 'Drop In' });
    const { result } = renderWorkflow({ session: openSession, roster: [] });

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
    const openSession = makeProgramSession({ enrollmentRequired: false });
    const { result } = renderWorkflow({ session: openSession, roster: savedRoster });

    await waitFor(() => expect(result.current.attendanceLoading).toBe(false));
    expect(result.current.roster).toEqual(savedRoster);
    expect(result.current.youth.map(profile => profile.id)).toContain('youth-1');
    expect(getAttendanceYouth).toHaveBeenCalledWith(expect.objectContaining({ signal: expect.any(AbortSignal) }));

    act(() => result.current.toggleOpenAttendee('youth-1'));
    expect(result.current.selectedYouthIds).toEqual([]);
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

  it('keeps source attendance and youth unchanged while comparing the draft checks', async () => {
    const openSession = makeProgramSession({ enrollmentRequired: false });
    const { result, queryClient } = renderWorkflow({ session: openSession });
    await waitFor(() => expect(result.current.attendanceLoading).toBe(false));
    const loadedYouth = queryClient.getQueryData([...SESSION_QUERY_KEY, 'attendance-youth']);
    expect(result.current.hasAttendanceChanges).toBe(false);

    act(() => result.current.toggleOpenAttendee('youth-1'));
    expect(result.current.selectedYouthIds).toEqual([]);
    expect(result.current.hasAttendanceChanges).toBe(true);
    expect(result.current.roster).toBe(roster);
    expect(queryClient.getQueryData([...SESSION_QUERY_KEY, 'attendance-youth'])).toBe(loadedYouth);

    act(() => result.current.toggleOpenAttendee('youth-1'));
    expect(result.current.selectedYouthIds).toEqual(['youth-1']);
    expect(result.current.hasAttendanceChanges).toBe(false);
    await act(() => result.current.submit());
    expect(setSessionAttendance).not.toHaveBeenCalled();
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

});
