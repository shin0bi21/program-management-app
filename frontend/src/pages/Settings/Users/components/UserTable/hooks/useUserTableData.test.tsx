import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { User } from '../../../types';
import { createQueryClientWrapper, createTestQueryClient } from '../../../../../../tests/queryClientTestUtils';
import { getAccounts } from '../../../accounts.api';
import useUserTableData from './useUserTableData';

vi.mock('../../../accounts.api', () => ({ getAccounts: vi.fn() }));

const account: User = {
  id: 'account-1', firstName: 'Alice', lastName: 'Admin', email: 'alice@example.com',
  role: 'admin', status: 'active', createdAt: '2026-01-01T00:00:00.000Z',
};

describe('useUserTableData', () => {
  beforeEach(() => vi.clearAllMocks());

  it('waits for initialized filters and sends every table control', async () => {
    vi.mocked(getAccounts).mockResolvedValue({ rows: [account], nextCursor: null });
    const client = createTestQueryClient();
    const filters = { search: 'alice', roles: ['admin' as const], statuses: ['active' as const] };
    const sorting = { key: 'name' as const, direction: 'asc' as const };
    const { result, rerender } = renderHook(
      ({ readyFilters }: { readyFilters: typeof filters | null }) => (
        useUserTableData(['accounts', 'table'], readyFilters, sorting)
      ),
      { initialProps: { readyFilters: null as typeof filters | null }, wrapper: createQueryClientWrapper(client) },
    );
    expect(getAccounts).not.toHaveBeenCalled();

    rerender({ readyFilters: filters });
    await waitFor(() => expect(result.current.rows).toEqual([account]));
    expect(getAccounts).toHaveBeenCalledWith(
      filters, { ...sorting, cursor: undefined, limit: 25 }, { signal: expect.any(AbortSignal) },
    );
  });

  it('forwards the server cursor when loading the next page', async () => {
    vi.mocked(getAccounts).mockImplementation(async (_filters, pagination) => (
      pagination?.cursor
        ? { rows: [{ ...account, id: 'account-2' }], nextCursor: null }
        : { rows: [account], nextCursor: 'cursor-2' }
    ));
    const client = createTestQueryClient();
    const { result } = renderHook(
      () => useUserTableData(['accounts', 'table'], {}, { key: 'name', direction: 'asc' }),
      { wrapper: createQueryClientWrapper(client) },
    );
    await waitFor(() => expect(result.current.hasNextPage).toBe(true));
    act(() => result.current.loadNextPage());
    await waitFor(() => expect(getAccounts).toHaveBeenLastCalledWith(
      expect.any(Object), expect.objectContaining({ cursor: 'cursor-2' }), { signal: expect.any(AbortSignal) },
    ));
  });

  it('starts a fresh query when its base key, filters, or sorting changes', async () => {
    vi.mocked(getAccounts).mockResolvedValue({ rows: [account], nextCursor: null });
    const client = createTestQueryClient();
    const initialProps = {
      queryKey: ['accounts', 'table', 'first'] as readonly unknown[],
      filters: { search: 'alice' } as Parameters<typeof useUserTableData>[1],
      sorting: { key: 'name', direction: 'asc' } as Parameters<typeof useUserTableData>[2],
    };
    const { rerender } = renderHook(
      ({ queryKey, filters, sorting }) => useUserTableData(queryKey, filters, sorting),
      { initialProps, wrapper: createQueryClientWrapper(client) },
    );

    await waitFor(() => expect(getAccounts).toHaveBeenCalledTimes(1));
    rerender({ ...initialProps, queryKey: ['accounts', 'table', 'second'] });
    await waitFor(() => expect(getAccounts).toHaveBeenCalledTimes(2));
    rerender({ ...initialProps, queryKey: ['accounts', 'table', 'second'], filters: { search: 'new' } });
    await waitFor(() => expect(getAccounts).toHaveBeenCalledTimes(3));
    rerender({
      ...initialProps,
      queryKey: ['accounts', 'table', 'second'],
      filters: { search: 'new' },
      sorting: { key: 'name', direction: 'desc' },
    });
    await waitFor(() => expect(getAccounts).toHaveBeenCalledTimes(4));
  });
});
