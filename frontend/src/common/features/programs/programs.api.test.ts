// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { apiClient } from '../../../http/client';
import { getPrograms } from './programs.api';

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

});
