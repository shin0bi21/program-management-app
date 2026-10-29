import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { getHoursTableData } from '../../../hours.api';
import { makeHoursItem } from '../../../../../../tests/factories/hours';
import { createQueryClientWrapper, createTestQueryClient } from '../../../../../../tests/queryClientTestUtils';
import useHoursTableData from './useHoursTableData';

vi.mock('../../../hours.api', () => ({
  getHoursTableData: vi.fn(),
}));

const row = {
  id: 'entry-1',
  resourceId: 'staff-1',
  date: '2026-08-18',
  staffFirstName: 'Zoe',
  staffLastName: 'Wilson',
  staffName: 'Zoe Wilson',
  item: makeHoursItem({ id: 'entry-1', hours: 2 }),
};

describe('useHoursTableData', () => {
  beforeEach(() => vi.clearAllMocks());

  it('sends the complete table controls through the cursor API', async () => {
    vi.mocked(getHoursTableData).mockResolvedValue({ rows: [row], nextCursor: null });
    const client = createTestQueryClient();
    const filters = {
      staffIds: ['staff-1'], categories: ['meeting' as const], programIds: ['program-1'],
      types: ['other' as const], cycleIds: ['cycle-1'], search: 'team',
    };
    const sorting = { key: 'date' as const, direction: 'desc' as const };
    const { result } = renderHook(
      () => useHoursTableData(['hours', 'table'], filters, sorting),
      { wrapper: createQueryClientWrapper(client) },
    );

    await waitFor(() => expect(result.current.rows).toEqual([row]));
    expect(getHoursTableData).toHaveBeenCalledWith(
      filters,
      { signal: expect.any(AbortSignal) },
      { ...sorting, cursor: undefined, limit: 25 },
    );
  });

  it('forwards the server cursor when loading the next page', async () => {
    vi.mocked(getHoursTableData).mockImplementation(async (_filters, _options, pagination) => (
      pagination.cursor
        ? { rows: [{ ...row, id: 'entry-2' }], nextCursor: null }
        : { rows: [row], nextCursor: 'cursor-2' }
    ));
    const client = createTestQueryClient();
    const { result } = renderHook(
      () => useHoursTableData(
        ['hours', 'table'],
        { staffIds: [], categories: [], programIds: [], types: [], search: '' },
        { key: 'date', direction: 'desc' },
      ),
      { wrapper: createQueryClientWrapper(client) },
    );

    await waitFor(() => expect(result.current.hasNextPage).toBe(true));
    act(() => result.current.loadNextPage());
    await waitFor(() => expect(getHoursTableData).toHaveBeenLastCalledWith(
      expect.any(Object),
      { signal: expect.any(AbortSignal) },
      expect.objectContaining({ cursor: 'cursor-2' }),
    ));
  });

  it('starts a fresh query when its base key, filters, or sorting changes', async () => {
    vi.mocked(getHoursTableData).mockResolvedValue({ rows: [row], nextCursor: null });
    const client = createTestQueryClient();
    const initialProps = {
      queryKey: ['hours', 'table', 'first'] as readonly unknown[],
      filters: {
        staffIds: [], categories: [], programIds: [], types: [], search: 'team',
      } as Parameters<typeof useHoursTableData>[1],
      sorting: { key: 'date', direction: 'desc' } as Parameters<typeof useHoursTableData>[2],
    };
    const changedFilters = { ...initialProps.filters, search: 'new' };
    const { rerender } = renderHook(
      ({ queryKey, filters, sorting }) => useHoursTableData(queryKey, filters, sorting),
      { initialProps, wrapper: createQueryClientWrapper(client) },
    );

    await waitFor(() => expect(getHoursTableData).toHaveBeenCalledTimes(1));
    rerender({ ...initialProps, queryKey: ['hours', 'table', 'second'] });
    await waitFor(() => expect(getHoursTableData).toHaveBeenCalledTimes(2));
    rerender({ ...initialProps, queryKey: ['hours', 'table', 'second'], filters: changedFilters });
    await waitFor(() => expect(getHoursTableData).toHaveBeenCalledTimes(3));
    rerender({
      ...initialProps,
      queryKey: ['hours', 'table', 'second'],
      filters: changedFilters,
      sorting: { key: 'date', direction: 'asc' },
    });
    await waitFor(() => expect(getHoursTableData).toHaveBeenCalledTimes(4));
  });
});
