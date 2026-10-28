// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { apiClient } from '../../../http/client';
import { createProgram, getPrograms, setProgramCycles, updateProgram } from './programs.api';

vi.mock('../../../http/client', () => ({
  apiClient: { get: vi.fn(), post: vi.fn(), put: vi.fn() },
}));

describe('programs API', () => {
  beforeEach(() => vi.clearAllMocks());

  it('requests only assigned programs when that scope is selected', () => {
    const signal = new AbortController().signal;

    getPrograms({ assignedOnly: true }, { signal });

    expect(apiClient.get).toHaveBeenCalledWith('/programs?scope=assigned', { signal });
  });

  it('replaces cycle assignments with one atomic request and returns the server result', async () => {
    const saved = { programId: 'program-1', cycleIds: ['cycle-2'] };
    vi.mocked(apiClient.put).mockResolvedValueOnce(saved);

    expect(await setProgramCycles('program-1', ['cycle-2'])).toEqual(saved);
    expect(apiClient.put).toHaveBeenCalledWith('/programs/program-1/cycles', { cycleIds: ['cycle-2'] });
  });

  it('preserves create and update fields', () => {
    createProgram({
      name: 'Future Ready',
      description: 'Career skills',
      enrollmentRequired: true,
      minAge: 12,
      maxAge: 15,
    });
    updateProgram('program-1', { name: 'Job Readiness', description: 'Career skills', enrollmentRequired: false });

    expect(apiClient.post).toHaveBeenCalledWith('/programs', {
      name: 'Future Ready',
      description: 'Career skills',
      enrollmentRequired: true,
      minAge: 12,
      maxAge: 15,
    });
    expect(apiClient.put).toHaveBeenCalledWith('/programs/program-1', {
      name: 'Job Readiness',
      description: 'Career skills',
      enrollmentRequired: false,
    });
  });
});
