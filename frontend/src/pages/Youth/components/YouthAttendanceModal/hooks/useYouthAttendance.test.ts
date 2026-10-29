import { makeYouthProfile } from '../../../../../tests/factories/youth';
// Scope: verifies youth-attendance loading, selection, and save coordination.
import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createQueryClientWrapper, createTestQueryClient } from '../../../../../tests/queryClientTestUtils';
import { getYouthCohortAttendance, setYouthCohortAttendance } from '../youthAttendance.api';
import type { YouthCohortAttendance } from '../types';
import useYouthAttendance from './useYouthAttendance';

vi.mock('../youthAttendance.api', () => ({
  getYouthCohortAttendance: vi.fn(),
  setYouthCohortAttendance: vi.fn(),
}));

const attendance: YouthCohortAttendance = {
  cohort: { id: 'cohort-1', name: 'Cohort', programName: 'Program', enrollmentRequired: true },
  sessions: [{
    id: 'session-1',
    sessionTypeName: 'Regular',
    theme: 'Communication',
    startsAt: '2026-08-19T17:00:00.000Z',
    endsAt: '2026-08-19T19:00:00.000Z',
    cancelledAt: null,
    status: null,
    notes: 'Existing note',
    sessionNotes: [],
  }],
};

describe('useYouthAttendance', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getYouthCohortAttendance).mockResolvedValue(attendance);
    vi.mocked(setYouthCohortAttendance).mockResolvedValue({ ...attendance, youth: makeYouthProfile() });
  });

  it('loads attendance and saves the selected session status', async () => {
    const onSaved = vi.fn();
    const queryClient = createTestQueryClient();
    const { result } = renderHook(() => useYouthAttendance({
      youthId: 'youth-1',
      cohortId: 'cohort-1',
      onSaved,
    }), { wrapper: createQueryClientWrapper(queryClient) });

    await waitFor(() => expect(result.current.attendance).toEqual(attendance));
    act(() => result.current.updateStatus('session-1', 'present'));
    await act(async () => result.current.save());

    expect(setYouthCohortAttendance).toHaveBeenCalledWith('youth-1', 'cohort-1', [{
      sessionId: 'session-1',
      status: 'present',
      notes: 'Existing note',
    }]);
    expect(onSaved).toHaveBeenCalledWith({ ...attendance, youth: makeYouthProfile() });
    expect(result.current.submitStatus).toBe('success');
  });
});
