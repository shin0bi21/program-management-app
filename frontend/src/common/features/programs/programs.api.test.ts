// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { apiClient } from '../../../http/client';
import { createProgram, getPrograms, updateProgram } from './programs.api';

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

  it('preserves create and update fields', () => {
    createProgram({
      name: 'Future Ready',
      description: 'Career skills',
      rosterMode: 'enrolled',
      minAge: 12,
      maxAge: 15,
    });
    updateProgram('program-1', { name: 'Job Readiness', description: 'Career skills' });

    expect(apiClient.post).toHaveBeenCalledWith('/programs', {
      name: 'Future Ready',
      description: 'Career skills',
      rosterMode: 'enrolled',
      minAge: 12,
      maxAge: 15,
    });
    expect(apiClient.put).toHaveBeenCalledWith('/programs/program-1', {
      name: 'Job Readiness',
      description: 'Career skills',
    });
  });
});
