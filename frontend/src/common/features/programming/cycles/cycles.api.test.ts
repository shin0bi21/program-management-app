// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { apiClient } from '../../../../http/client';
import { deleteProgramCycle, getProgramCycles, setProgramCycle } from './cycles.api';

vi.mock('../../../../http/client', () => ({
  apiClient: { delete: vi.fn(), get: vi.fn(), post: vi.fn(), put: vi.fn() },
}));

describe('cycle API', () => {
  beforeEach(() => vi.clearAllMocks());

  it('loads cycles with request options', () => {
    const signal = new AbortController().signal;
    getProgramCycles({ signal });

    expect(apiClient.get).toHaveBeenCalledWith('/cohorts/cycles', { signal });
  });

  it('creates, updates, and deletes cycles through the existing endpoints', () => {
    const input = { name: 'Fall 2026', startsOn: '2026-09-01', endsOn: '2027-01-31' };
    setProgramCycle(input);
    setProgramCycle(input, 'cycle-1');
    deleteProgramCycle('cycle-1');

    expect(apiClient.post).toHaveBeenCalledWith('/cohorts/cycles', input);
    expect(apiClient.put).toHaveBeenCalledWith('/cohorts/cycles/cycle-1', input);
    expect(apiClient.delete).toHaveBeenCalledWith('/cohorts/cycles/cycle-1');
  });
});
