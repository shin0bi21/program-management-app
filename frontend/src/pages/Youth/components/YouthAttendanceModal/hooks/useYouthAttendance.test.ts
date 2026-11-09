import { makeYouthProfile } from '../../../../../tests/factories/youth';
import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createQueryClientWrapper, createTestQueryClient } from '../../../../../tests/queryClientTestUtils';
import { setYouthProgramCycleAttendance } from '../youthAttendance.api';
import type { YouthProgramCycleAttendance } from '../types';
import useYouthAttendance from './useYouthAttendance';

vi.mock('../youthAttendance.api', () => ({
  setYouthProgramCycleAttendance: vi.fn(),
}));

const attendance: YouthProgramCycleAttendance = {
  programCycle: { programId: 'program-1', cycleId: 'cycle-1', cycle: 'ProgramCycle', program: 'Program', enrollmentRequired: true },
  sessions: [{
    id: 'session-1',
    sessionType: 'Regular',
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
    vi.mocked(setYouthProgramCycleAttendance).mockResolvedValue({ ...attendance, youth: makeYouthProfile() });
  });

  it('saves the selected session status from supplied attendance', async () => {
    const onSaved = vi.fn();
    const queryClient = createTestQueryClient();
    const { result } = renderHook(() => useYouthAttendance({
      youthId: 'youth-1',
      attendance,
      onSaved,
    }), { wrapper: createQueryClientWrapper(queryClient) });

    act(() => result.current.updateStatus('session-1', 'present'));
    await act(async () => result.current.save());

    expect(setYouthProgramCycleAttendance).toHaveBeenCalledWith('youth-1', { programId: 'program-1', cycleId: 'cycle-1' }, [{
      sessionId: 'session-1',
      status: 'present',
      notes: 'Existing note',
    }]);
    expect(onSaved).toHaveBeenCalledWith({ ...attendance, youth: makeYouthProfile() });
    expect(result.current.submitStatus).toBe('success');
  });
});
