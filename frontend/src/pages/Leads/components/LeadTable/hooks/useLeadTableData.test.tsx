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

  it('configures the lead table key and forwards filters, sorting, and cancellation', async () => {
    const baseKey = ['leads', 'table', 'external'];
    const filters = { search: 'avery', statuses: ['new' as const], programIds: ['program-1'] };
    const sorting = { key: 'created' as const, direction: 'desc' as const };
    renderHook(() => useLeadTableData(baseKey, filters, sorting));

    const options = vi.mocked(useInfiniteListQuery).mock.lastCall![0];
    expect(options.queryKey).toEqual([...baseKey, filters, sorting]);
    expect(options.enabled).toBe(true);

    const signal = new AbortController().signal;
    await options.queryFn({ signal, pageParam: 'cursor-2' } as Parameters<typeof options.queryFn>[0]);
    expect(getLeads).toHaveBeenLastCalledWith(
      filters, { ...sorting, cursor: 'cursor-2' }, { signal },
    );
  });

  it('disables the query until lead filters are initialized', () => {
    const sorting = { key: 'created' as const, direction: 'desc' as const };
    renderHook(() => useLeadTableData(['leads', 'table'], null, sorting));

    const options = vi.mocked(useInfiniteListQuery).mock.lastCall![0];
    expect(options.enabled).toBe(false);
    expect(options.queryKey).toEqual(['leads', 'table', null, sorting]);
  });
});
