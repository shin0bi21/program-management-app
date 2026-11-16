// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { apiClient } from '../../../../http/client';
import { deleteProgramCycle, getCycleList, setProgramCycle } from './cycles.api';

vi.mock('../../../../http/client', () => ({
  apiClient: { delete: vi.fn(), get: vi.fn(), post: vi.fn(), put: vi.fn() },
}));

describe('cycle API', () => {
  beforeEach(() => vi.clearAllMocks());

  it('serializes table pagination and forwards cancellation', () => {
    const signal = new AbortController().signal;
    getCycleList({ key: 'title', direction: 'asc', cursor: 'next-page' }, { signal });

    expect(apiClient.get).toHaveBeenCalledWith('/cycles/list?sort=title&direction=asc&cursor=next-page', { signal });
  });

  it('creates, updates, and deletes cycles through the existing endpoints', () => {
    const input = { title: 'Fall 2026', startsOn: '2026-09-01', endsOn: '2027-01-31', programIds: ['program-1'] };
    setProgramCycle(input);
    setProgramCycle(input, 'cycle-1');
    deleteProgramCycle('cycle-1');

    expect(apiClient.post).toHaveBeenCalledWith('/cycles', input);
    expect(apiClient.put).toHaveBeenCalledWith('/cycles/cycle-1', input);
    expect(apiClient.delete).toHaveBeenCalledWith('/cycles/cycle-1');
  });
});
