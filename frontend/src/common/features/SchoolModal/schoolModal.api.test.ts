// Scope: verifies school adapter loading and mutation endpoints.
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { apiClient } from '../../../http/client';
import { createSchool, deleteSchool, setSchool } from './schoolModal.api';

vi.mock('../../../http/client', () => ({
  apiClient: { delete: vi.fn(), get: vi.fn(), post: vi.fn() },
}));

describe('schools API', () => {
  beforeEach(() => vi.clearAllMocks());

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
