import { beforeEach, describe, expect, expectTypeOf, it, vi } from 'vitest';

import { apiClient } from '../../http/client';
import type { YouthProfile } from './types';
import { getYouth, setYouth } from './youth.api';

vi.mock('../../http/client', () => ({
  apiClient: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() },
}));

describe('youth API', () => {
  beforeEach(() => vi.clearAllMocks());

  it('serializes filters and cursor pagination into the backend contract', () => {
    getYouth(undefined, {
      search: '  Alex + Lee  ',
      statuses: ['active'],
      programIds: ['program-1'],
      cycleIds: ['cycle-1', 'cycle-2'],
    }, undefined, {
      key: 'firstName',
      direction: 'asc',
      limit: 50,
      cursor: 'cursor-1',
    });

    expect(apiClient.get).toHaveBeenCalledWith(
      '/youth?search=Alex+%2B+Lee&statuses=active&programIds=program-1&cycleIds=cycle-1%2Ccycle-2&sort=firstName&direction=asc&limit=50&cursor=cursor-1',
    );
  });

  it('returns one nullable profile when an id is supplied', async () => {
    const profile = { id: 'youth-1' } as YouthProfile;
    vi.mocked(apiClient.get).mockResolvedValue(profile);

    const result = await getYouth('youth-1');

    expectTypeOf(result).toEqualTypeOf<YouthProfile | null>();
    expect(result).toBe(profile);
    expect(apiClient.get).toHaveBeenCalledWith('/youth?id=youth-1');
  });

  it('creates and updates profiles through the youth upsert endpoint', () => {
    setYouth({ firstName: 'Maya', lastName: 'Thompson' });
    setYouth({ id: 'youth-1', firstName: 'Maya', lastName: 'Lee' });

    expect(apiClient.post).toHaveBeenNthCalledWith(1, '/youth', {
      firstName: 'Maya',
      lastName: 'Thompson',
    });
    expect(apiClient.post).toHaveBeenNthCalledWith(2, '/youth', {
      id: 'youth-1',
      firstName: 'Maya',
      lastName: 'Lee',
    });
    expect(apiClient.put).not.toHaveBeenCalled();
  });
});

// @vitest-environment node
