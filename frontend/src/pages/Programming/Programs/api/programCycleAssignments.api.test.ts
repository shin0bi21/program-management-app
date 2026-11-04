// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { apiClient } from '../../../../http/client';
import { enrollYouth, withdrawYouth, getProgramCycleAssignments, getProgramRosterYouth } from './programCycleAssignments.api';

vi.mock('../../../../http/client', () => ({
  apiClient: { delete: vi.fn(), get: vi.fn(), post: vi.fn(), patch: vi.fn() },
}));

describe('program cycle assignment API', () => {
  beforeEach(() => vi.clearAllMocks());

  it('loads assignments for a program and forwards all-program scope and cancellation', () => {
    const options = { signal: new AbortController().signal };
    getProgramCycleAssignments('program-1', { includeAllPrograms: true }, options);

    expect(apiClient.get).toHaveBeenCalledWith('/programs/cycle-assignments?programId=program-1&scope=all', options);
  });

  it('loads youth through the programCycle roster contract', () => {
    getProgramRosterYouth({ programId: 'program-1', cycleId: 'cycle-1' });

    expect(apiClient.get).toHaveBeenCalledWith('/programs/program-1/cycles/cycle-1/roster');
  });

  it('forwards cancellation when loading a programCycle roster', () => {
    const options = { signal: new AbortController().signal };
    getProgramRosterYouth({ programId: 'program-1', cycleId: 'cycle-1' }, options);

    expect(apiClient.get).toHaveBeenCalledWith('/programs/program-1/cycles/cycle-1/roster', options);
  });
  it('filters assignments by cycle and mutates enrollments using both IDs', () => {
    const pair = { programId: 'program-1', cycleId: 'cycle-1' };
    getProgramCycleAssignments('program-1', { cycleId: 'cycle-1' });
    enrollYouth(pair, { youthIds: ['youth-1'] });
    withdrawYouth(pair, 'youth-1');

    expect(apiClient.get).toHaveBeenCalledWith('/programs/cycle-assignments?programId=program-1&cycleId=cycle-1');
    expect(apiClient.post).toHaveBeenCalledWith('/programs/program-1/cycles/cycle-1/enrollments', { youthIds: ['youth-1'] });
    expect(apiClient.patch).toHaveBeenCalledWith('/programs/program-1/cycles/cycle-1/enrollments/youth-1/withdraw');
  });

});
