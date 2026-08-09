import { beforeEach, describe, expect, it, vi } from 'vitest';
import { apiClient } from '../../../../http/client';
import { getYouth } from './youth.api';

vi.mock('../../../../http/client', () => ({
  apiClient: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() },
}));

describe('youth API', () => {
  beforeEach(() => vi.clearAllMocks());

  it('serializes filters and cursor pagination into the backend contract', () => {
    getYouth(undefined, {
      search: 'Alex + Lee',
      statuses: ['active'],
      programIds: ['program-1'],
      cohortIds: ['cohort-1'],
    }, undefined, {
      key: 'firstName',
      direction: 'asc',
      limit: 50,
      cursor: 'cursor-1',
    });

    expect(apiClient.get).toHaveBeenCalledWith(
      '/youth?search=Alex+%2B+Lee&statuses=active&programIds=program-1&cohortIds=cohort-1&sort=firstName&direction=asc&limit=50&cursor=cursor-1',
    );
  });
});
