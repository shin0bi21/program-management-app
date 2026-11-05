import { renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import useInfiniteListQuery from '../../../../../../query/hooks/useInfiniteListQuery';
import { getAccounts } from '../../../accounts.api';
import useUserTableData from './useUserTableData';

vi.mock('../../../../../../query/hooks/useInfiniteListQuery', () => ({ default: vi.fn(() => ({ rows: [] })) }));
vi.mock('../../../accounts.api', () => ({ getAccounts: vi.fn() }));

describe('useUserTableData', () => {
  beforeEach(() => vi.clearAllMocks());

  it('configures the account table key and forwards filters, sorting, cursors, and cancellation', async () => {
    const baseKey = ['accounts', 'table', 'staff'];
    const filters = { search: 'alice', roles: ['staff' as const], statuses: ['active' as const] };
    const sorting = { key: 'name' as const, direction: 'asc' as const };
    renderHook(() => useUserTableData(baseKey, filters, sorting));

    const options = vi.mocked(useInfiniteListQuery).mock.lastCall![0];
    expect(options.queryKey).toEqual([...baseKey, filters, sorting]);
    expect(options.enabled).toBe(true);

    const signal = new AbortController().signal;
    const context = (pageParam: string | null) => ({ signal, pageParam } as Parameters<typeof options.queryFn>[0]);
    await options.queryFn(context(null));
    expect(getAccounts).toHaveBeenLastCalledWith(
      filters, { ...sorting, cursor: undefined, limit: 50 }, { signal },
    );

    await options.queryFn(context('cursor-2'));
    expect(getAccounts).toHaveBeenLastCalledWith(
      filters, { ...sorting, cursor: 'cursor-2', limit: 50 }, { signal },
    );
  });

  it('disables the query until account filters are initialized', () => {
    const sorting = { key: 'name' as const, direction: 'asc' as const };
    renderHook(() => useUserTableData(['accounts', 'table'], null, sorting));

    const options = vi.mocked(useInfiniteListQuery).mock.lastCall![0];
    expect(options.enabled).toBe(false);
    expect(options.queryKey).toEqual(['accounts', 'table', null, sorting]);
  });
});
