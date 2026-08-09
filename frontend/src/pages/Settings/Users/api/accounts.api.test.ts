import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getAccounts } from './accounts.api';
import { apiClient } from '../../../../http/client';

vi.mock('../../../../http/client', () => ({
  apiClient: { get: vi.fn(), post: vi.fn(), patch: vi.fn(), delete: vi.fn() },
}));

describe('accounts API', () => {
  beforeEach(() => vi.mocked(apiClient.get).mockReset());

  it('serializes account filters into the backend query contract', () => {
    getAccounts({ search: 'Alex + Lee', roles: ['admin', 'staff'], statuses: ['active', 'invited'] });

    expect(apiClient.get).toHaveBeenCalledWith(
      '/accounts?search=Alex+%2B+Lee&roles=admin%2Cstaff&statuses=active%2Cinvited',
    );
  });

  it('omits empty filters', () => {
    getAccounts({ search: '  ', roles: [], statuses: [] });
    expect(apiClient.get).toHaveBeenCalledWith('/accounts');
  });
});
