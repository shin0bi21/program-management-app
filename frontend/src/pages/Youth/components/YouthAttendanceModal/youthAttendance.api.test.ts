// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { apiClient } from '../../../../http/client';
import { setYouthProgramCycleAttendance } from './youthAttendance.api';

vi.mock('../../../../http/client', () => ({
  apiClient: { put: vi.fn() },
}));

describe('youth attendance API', () => {
  beforeEach(() => vi.clearAllMocks());

  it('replaces attendance through the exact records payload', () => {
    const records = [{ sessionId: 'session-1', status: 'present' as const, notes: 'Joined late.' }];

    setYouthProgramCycleAttendance('youth-1', { programId: 'program-1', cycleId: 'cycle-1' }, records);

    expect(apiClient.put).toHaveBeenCalledWith(
      '/youth/youth-1/programs/program-1/cycles/cycle-1/attendance',
      { records },
    );
  });
});
