import { renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import useInfiniteListQuery from '../../../../../../query/hooks/useInfiniteListQuery';
import { getHoursTableData } from '../../../hours.api';
import useHoursTableData from './useHoursTableData';

vi.mock('../../../../../../query/hooks/useInfiniteListQuery', () => ({
  default: vi.fn(() => ({ rows: [] })),
}));
vi.mock('../../../hours.api', () => ({ getHoursTableData: vi.fn() }));

const filters = {
  staffIds: ['staff-1'], categories: ['meeting' as const], programIds: ['program-1'],
  types: ['regular' as const], cycleIds: ['cycle-1'], search: 'team',
};
const sorting = { key: 'date' as const, direction: 'desc' as const };
const dateRange = { start: '2026-07-01', end: '2026-09-01' };

describe('useHoursTableData', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getHoursTableData).mockResolvedValue({ rows: [], nextCursor: null });
  });

  it('keys the applied controls and forwards the domain request', async () => {
    renderHook(() => useHoursTableData(['hours', 'table'], filters, dateRange, sorting));
    const options = vi.mocked(useInfiniteListQuery).mock.lastCall![0];
    const signal = new AbortController().signal;

    expect(options.queryKey).toEqual(['hours', 'table', filters, dateRange, sorting]);
    await options.queryFn({ signal, pageParam: 'cursor-2' } as Parameters<typeof options.queryFn>[0]);
    expect(getHoursTableData).toHaveBeenLastCalledWith(
      { filters, dateRange }, { signal }, { ...sorting, cursor: 'cursor-2' },
    );
  });
});
