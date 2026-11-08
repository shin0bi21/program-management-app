import { createQueryClientWrapper, createTestQueryClient } from '../../../../../tests/queryClientTestUtils';
import { renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import useInfiniteListQuery from '../../../../../query/hooks/useInfiniteListQuery';
import { getLeads } from '../../../leads.api';
import { useLeadTableData } from './useLeadTableData';

vi.mock('../../../../../query/hooks/useInfiniteListQuery', () => ({ default: vi.fn(() => ({ rows: [] })) }));
vi.mock('../../../leads.api', () => ({ getLeads: vi.fn() }));

describe('useLeadTableData', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getLeads).mockResolvedValue({ rows: [], nextCursor: null });
  });

  it('configures the lead table key and forwards filters, sorting, cursors, and cancellation', async () => {
    const baseKey = ['leads', 'table', 'external'];
    const filters = { search: 'avery', statuses: ['new' as const], programIds: ['program-1'] };
    const sorting = { key: 'created' as const, direction: 'desc' as const };
    renderHook(() => useLeadTableData(baseKey, filters, sorting, {}), { wrapper: createQueryClientWrapper(createTestQueryClient()) });

    const options = vi.mocked(useInfiniteListQuery).mock.lastCall![0];
    expect(options.queryKey).toEqual([...baseKey, filters, sorting]);
    expect(options.enabled).toBe(true);

    const signal = new AbortController().signal;
    const context = (pageParam: string | null) => ({ signal, pageParam } as Parameters<typeof options.queryFn>[0]);
    await options.queryFn(context(null));
    expect(getLeads).toHaveBeenLastCalledWith(
      filters, { ...sorting, cursor: undefined, limit: 50 }, { signal },
    );

    await options.queryFn(context('cursor-2'));
    expect(getLeads).toHaveBeenLastCalledWith(
      filters, { ...sorting, cursor: 'cursor-2', limit: 50 }, { signal },
    );
  });

  it('disables the query until lead filters are initialized', () => {
    const sorting = { key: 'created' as const, direction: 'desc' as const };
    renderHook(() => useLeadTableData(['leads', 'table'], null, sorting, {}), { wrapper: createQueryClientWrapper(createTestQueryClient()) });

    const options = vi.mocked(useInfiniteListQuery).mock.lastCall![0];
    expect(options.enabled).toBe(false);
    expect(options.queryKey).toEqual(['leads', 'table', null, sorting]);
  });
});
