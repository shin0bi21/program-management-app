import { renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import useInfiniteListQuery from '../../../../../query/hooks/useInfiniteListQuery';
import { getYouth } from '../../../youth.api';
import useYouthTableData from './useYouthTableData';

vi.mock('../../../../../query/hooks/useInfiniteListQuery', () => ({ default: vi.fn(() => ({ rows: [] })) }));
vi.mock('../../../youth.api', () => ({ getYouth: vi.fn() }));

describe('useYouthTableData', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getYouth).mockResolvedValue({ rows: [], nextCursor: null } as never);
  });

  it('configures the youth table key and forwards filters, sorting, and cancellation', async () => {
    const filters = { search: 'avery', cycleIds: ['cycle-1'] };
    const sorting = { key: 'lastName' as const, direction: 'desc' as const };
    renderHook(() => useYouthTableData(filters, sorting));

    const options = vi.mocked(useInfiniteListQuery).mock.lastCall![0];
    expect(options.queryKey).toEqual(['youth', 'table', filters, sorting]);
    expect(options.enabled).toBe(true);

    const signal = new AbortController().signal;
    await options.queryFn({ signal, pageParam: 'cursor-2' } as Parameters<typeof options.queryFn>[0]);
    expect(getYouth).toHaveBeenLastCalledWith(
      undefined, filters, { signal }, { ...sorting, cursor: 'cursor-2', limit: 50 },
    );
  });

  it('disables the query until youth filters are initialized', () => {
    renderHook(() => useYouthTableData(null));

    const options = vi.mocked(useInfiniteListQuery).mock.lastCall![0];
    expect(options.enabled).toBe(false);
    expect(options.queryKey).toEqual(['youth', 'table', null, { key: 'firstName', direction: 'asc' }]);
  });
});
