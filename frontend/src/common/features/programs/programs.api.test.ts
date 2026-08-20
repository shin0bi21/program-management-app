// Scope: verifies program adapter scope serialization and create/update commands.
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

  it('normalizes the shorthand create command and preserves update fields', () => {
    createProgram('Soft Skills');
    updateProgram('program-1', { name: 'Job Readiness', description: 'Career skills' });

    expect(apiClient.post).toHaveBeenCalledWith('/programs', { name: 'Soft Skills' });
    expect(apiClient.put).toHaveBeenCalledWith('/programs/program-1', {
      name: 'Job Readiness',
      description: 'Career skills',
    });
  });
});

// @vitest-environment node
