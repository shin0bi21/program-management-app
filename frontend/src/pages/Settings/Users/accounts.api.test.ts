// @vitest-environment node

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getAccounts } from './accounts.api';
import { apiClient } from '../../../http/client';

vi.mock('../../../http/client', () => ({
  apiClient: { get: vi.fn(), post: vi.fn(), patch: vi.fn(), delete: vi.fn() },
}));

describe('accounts API', () => {
  beforeEach(() => vi.mocked(apiClient.get).mockReset());

  it('serializes account filters into the backend query contract', () => {
    const options = { signal: new AbortController().signal };
    getAccounts(
      { search: 'Alex + Lee', roles: ['admin', 'staff'], statuses: ['active', 'invited'] },
      { key: 'name', direction: 'asc', cursor: 'cursor-2' },
      options,
    );

    expect(apiClient.get).toHaveBeenCalledWith(
      '/accounts?search=Alex+%2B+Lee&roles=admin%2Cstaff&statuses=active%2Cinvited&sort=name&direction=asc&paginate=true&cursor=cursor-2',
      options,
    );
  });

  it('omits empty filters', () => {
    getAccounts({ search: '  ', roles: [], statuses: [] }, { key: 'name', direction: 'asc' });
    expect(apiClient.get).toHaveBeenCalledWith('/accounts?sort=name&direction=asc&paginate=true');
  });
});
