// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { apiClient } from '../../../../http/client';
import { getProgramList, createProgram, setProgramCycles, updateProgram } from './programs.api';

vi.mock('../../../../http/client', () => ({
  apiClient: { get: vi.fn(), post: vi.fn(), put: vi.fn() },
}));

describe('programs API', () => {
  beforeEach(() => vi.clearAllMocks());

  it('serializes table pagination and scope while forwarding cancellation and the cursor envelope', async () => {
    const signal = new AbortController().signal;
    const page = { rows: [], nextCursor: 'next' };
    vi.mocked(apiClient.get).mockResolvedValueOnce(page);

    expect(await getProgramList({ assignedOnly: true }, { key: 'title', direction: 'asc', cursor: 'previous' }, { signal })).toBe(page);
    expect(apiClient.get).toHaveBeenCalledWith('/programs/list?sort=title&direction=asc&scope=assigned&cursor=previous', { signal });

    getProgramList({}, { key: 'title', direction: 'desc' });
    expect(apiClient.get).toHaveBeenLastCalledWith('/programs/list?sort=title&direction=desc', undefined);
  });

  it('replaces cycle assignments with one atomic request and returns the server result', async () => {
    const saved = { programId: 'program-1', cycleIds: ['cycle-2'] };
    vi.mocked(apiClient.put).mockResolvedValueOnce(saved);

    expect(await setProgramCycles('program-1', ['cycle-2'])).toEqual(saved);
    expect(apiClient.put).toHaveBeenCalledWith('/programs/program-1/cycles', { cycleIds: ['cycle-2'] });
  });

  it('preserves create and update fields', () => {
    createProgram({
      title: 'Future Ready',
      description: 'Career skills',
      enrollmentRequired: true,
      minAge: 12,
      maxAge: 15,
    });
    updateProgram('program-1', { title: 'Job Readiness', description: 'Career skills', enrollmentRequired: false });

    expect(apiClient.post).toHaveBeenCalledWith('/programs', {
      title: 'Future Ready',
      description: 'Career skills',
      enrollmentRequired: true,
      minAge: 12,
      maxAge: 15,
    });
    expect(apiClient.put).toHaveBeenCalledWith('/programs/program-1', {
      title: 'Job Readiness',
      description: 'Career skills',
      enrollmentRequired: false,
    });
  });
});
