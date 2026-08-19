// Scope: verifies school adapter loading and mutation endpoints.
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { apiClient } from '../../../../../../http/client';
import { createSchool, deleteSchool, getSchools, setSchool } from './schools.api';

vi.mock('../../../../../../http/client', () => ({
  apiClient: { delete: vi.fn(), get: vi.fn(), post: vi.fn() },
}));

describe('schools API', () => {
  beforeEach(() => vi.clearAllMocks());

  it('loads schools with request cancellation', () => {
    const signal = new AbortController().signal;

    getSchools({ signal });

    expect(apiClient.get).toHaveBeenCalledWith('/schools', { signal });
  });

  it('keeps create, save, and delete commands on their narrow endpoints', () => {
    createSchool('Central High');
    setSchool({ id: 'school-1', name: 'Central Collegiate' });
    deleteSchool('school-1');

    expect(apiClient.post).toHaveBeenNthCalledWith(1, '/schools', { name: 'Central High' });
    expect(apiClient.post).toHaveBeenNthCalledWith(2, '/schools', {
      id: 'school-1',
      name: 'Central Collegiate',
    });
    expect(apiClient.delete).toHaveBeenCalledWith('/schools/school-1');
  });
});

// @vitest-environment node
