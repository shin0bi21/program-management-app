import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import useInfiniteListQuery from '../../../../../../query/hooks/useInfiniteListQuery';
import { TABLE_PAGE_SIZE } from '../../../../../../query/types';
import { getHoursTableData } from '../../../hours.api';
import useHoursTableData from './useHoursTableData';
import { createQueryClientWrapper, createTestQueryClient } from '../../../../../../tests/queryClientTestUtils';
import { makeHoursItem } from '../../../../../../tests/factories/hours';
import { getHoursItem } from '../../../hoursItemStore';

vi.mock('../../../../../../query/hooks/useInfiniteListQuery', () => ({
  default: vi.fn(() => ({ rows: [] })),
}));
vi.mock('../../../hours.api', () => ({ getHoursTableData: vi.fn() }));

const filters = {
  staffIds: ['staff-1'], categories: ['meeting' as const], programIds: ['program-1'],
  types: ['regular' as const], cycleIds: ['cycle-1'], search: 'team',
};
const sorting = { key: 'date' as const, direction: 'desc' as const };

describe('useHoursTableData', () => {
  beforeEach(() => vi.clearAllMocks());

  it('passes table controls to the query owner and forwards initial and next-page API inputs', async () => {
    const client = createTestQueryClient();
    const entry = makeHoursItem();
    vi.mocked(getHoursTableData).mockResolvedValue({ rows: [entry], nextCursor: 'next' });
    renderHook(() => useHoursTableData(['hours', 'table'], filters, sorting), { wrapper: createQueryClientWrapper(client) });
    const options = vi.mocked(useInfiniteListQuery).mock.lastCall![0];
    const signal = new AbortController().signal;

    expect(options.queryKey).toEqual(['hours', 'table', filters, sorting]);
    await act(async () => {
      const page = await options.queryFn({ signal, pageParam: null } as Parameters<typeof options.queryFn>[0]);
      expect(page).toEqual({ rows: [{ id: entry.id, sortValue: entry.date }], nextCursor: 'next' });
    });
    expect(getHoursItem(client, entry.id)).toEqual(entry);
    expect(getHoursTableData).toHaveBeenLastCalledWith(
      filters, { signal }, { ...sorting, cursor: undefined, limit: TABLE_PAGE_SIZE },
    );

    await act(async () => options.queryFn({ signal, pageParam: 'cursor-2' } as Parameters<typeof options.queryFn>[0]));
    expect(getHoursTableData).toHaveBeenLastCalledWith(
      filters, { signal }, { ...sorting, cursor: 'cursor-2', limit: TABLE_PAGE_SIZE },
    );
  });

});
