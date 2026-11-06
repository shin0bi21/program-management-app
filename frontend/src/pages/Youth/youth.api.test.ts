// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { apiClient } from '../../http/client';
import type { YouthProfile } from './types';
import { getYouth, setYouth, setYouthContacts } from './youth.api';

vi.mock('../../http/client', () => ({
  apiClient: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() },
}));

describe('youth API', () => {
  beforeEach(() => vi.clearAllMocks());

  it('serializes filters and cursor pagination into the backend contract', () => {
    getYouth(undefined, {
      search: '  Alex + Lee  ',
      programIds: ['program-1'],
      cycleIds: ['cycle-1', 'cycle-2'],
    }, undefined, {
      key: 'firstName',
      direction: 'asc',
      limit: 50,
      cursor: 'cursor-1',
    });

    expect(apiClient.get).toHaveBeenCalledWith(
      '/youth?search=Alex+%2B+Lee&programIds=program-1&cycleIds=cycle-1%2Ccycle-2&sort=firstName&direction=asc&limit=50&cursor=cursor-1',
    );
  });

  it('returns the required profile when an id is supplied', async () => {
    const profile = { id: 'youth-1' } as YouthProfile;
    vi.mocked(apiClient.get).mockResolvedValue(profile);

    const result = await getYouth('youth-1');

    expect(result).toBe(profile);
    expect(apiClient.get).toHaveBeenCalledWith('/youth?id=youth-1');
  });

  it('updates only contacts and returns the authoritative profile', async () => {
    const profile = { id: 'youth-1', dateOfBirth: null } as YouthProfile;
    const contacts = [{ phoneNumber: '4165550100', type: 'parent' as const }];
    vi.mocked(apiClient.put).mockResolvedValue(profile);

    expect(await setYouthContacts('youth-1', contacts)).toBe(profile);
    expect(apiClient.put).toHaveBeenCalledWith('/youth/youth-1/contacts', { contacts });
    expect(apiClient.post).not.toHaveBeenCalled();
  });

  it('creates and updates profiles through the youth set endpoint', () => {
    setYouth({ firstName: 'Maya', lastName: 'Thompson', dateOfBirth: '2012-08-19' });
    setYouth({ id: 'youth-1', firstName: 'Maya', lastName: 'Lee', dateOfBirth: '2012-08-19' });

    expect(apiClient.post).toHaveBeenNthCalledWith(1, '/youth', {
      firstName: 'Maya',
      lastName: 'Thompson',
      dateOfBirth: '2012-08-19',
    });
    expect(apiClient.post).toHaveBeenNthCalledWith(2, '/youth', {
      id: 'youth-1',
      firstName: 'Maya',
      lastName: 'Lee',
      dateOfBirth: '2012-08-19',
    });
    expect(apiClient.put).not.toHaveBeenCalled();
  });
});
