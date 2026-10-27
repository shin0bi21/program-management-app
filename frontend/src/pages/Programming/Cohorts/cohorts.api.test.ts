// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { apiClient } from '../../../http/client';
import { getCohortPage, getCohortRosterYouth } from './cohorts.api';

vi.mock('../../../http/client', () => ({
  apiClient: { delete: vi.fn(), get: vi.fn(), post: vi.fn() },
}));

describe('cohort API', () => {
  beforeEach(() => vi.clearAllMocks());

  it('serializes cohort filters and pagination', () => {
    getCohortPage(
      { programId: 'program-1', search: 'Summer + Fall', status: 'active' },
      { key: 'start', direction: 'desc', limit: 10, cursor: 'cursor-1' },
    );

    expect(apiClient.get).toHaveBeenCalledWith(
      '/cohorts?programId=program-1&search=Summer+%2B+Fall&status=active&sort=start&direction=desc&limit=10&cursor=cursor-1',
    );
  });

  it('loads youth through the cohort roster contract', () => {
    getCohortRosterYouth();

    expect(apiClient.get).toHaveBeenCalledWith('/youth');
  });
});
