// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { apiClient } from '../../../../http/client';
import { getYouthProgramCycleAttendance, setYouthProgramCycleAttendance } from './youthAttendance.api';

vi.mock('../../../../http/client', () => ({
  apiClient: { get: vi.fn(), put: vi.fn() },
}));

describe('youth attendance API', () => {
  beforeEach(() => vi.clearAllMocks());

  it('loads programCycle attendance with and without request options', () => {
    const controller = new AbortController();

    getYouthProgramCycleAttendance('youth-1', { programId: 'program-1', cycleId: 'cycle-1' });
    getYouthProgramCycleAttendance('youth-1', { programId: 'program-1', cycleId: 'cycle-1' }, { signal: controller.signal });

    expect(apiClient.get).toHaveBeenNthCalledWith(
      1,
      '/youth/youth-1/programs/program-1/cycles/cycle-1/attendance',
    );
    expect(apiClient.get).toHaveBeenNthCalledWith(
      2,
      '/youth/youth-1/programs/program-1/cycles/cycle-1/attendance',
      { signal: controller.signal },
    );
  });

  it('replaces attendance through the exact records payload', () => {
    const records = [{ sessionId: 'session-1', status: 'present' as const, notes: 'Joined late.' }];

    setYouthProgramCycleAttendance('youth-1', { programId: 'program-1', cycleId: 'cycle-1' }, records);

    expect(apiClient.put).toHaveBeenCalledWith(
      '/youth/youth-1/programs/program-1/cycles/cycle-1/attendance',
      { records },
    );
  });
});
