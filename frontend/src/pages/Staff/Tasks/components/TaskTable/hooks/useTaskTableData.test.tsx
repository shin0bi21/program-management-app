import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { getTasksTableData } from '../../../tasks.api';
import { makeTask } from '../../../../../../tests/factories/task';
import { createQueryClientWrapper, createTestQueryClient } from '../../../../../../tests/queryClientTestUtils';
import useTaskTableData from './useTaskTableData';

vi.mock('../../../tasks.api', () => ({ getTasksTableData: vi.fn() }));

const task = makeTask();

describe('useTaskTableData', () => {
  beforeEach(() => vi.clearAllMocks());

  it('sends every table control through the cursor API', async () => {
    vi.mocked(getTasksTableData).mockResolvedValue({ rows: [task], nextCursor: null });
    const client = createTestQueryClient();
    const filters = {
      staffIds: ['staff-1'], programIds: ['program-1'], categories: ['planning_prep' as const],
      statuses: ['active' as const], search: 'workshop',
    };
    const sorting = { key: 'dueDate' as const, direction: 'asc' as const };
    const { result } = renderHook(
      () => useTaskTableData(['tasks', 'table'], filters, sorting, '2026-08-11'),
      { wrapper: createQueryClientWrapper(client) },
    );

    await waitFor(() => expect(result.current.rows).toEqual([task]));
    expect(getTasksTableData).toHaveBeenCalledWith(
      filters,
      { signal: expect.any(AbortSignal) },
      { ...sorting, cursor: undefined, limit: 50 },
    );
  });

  it('forwards the server cursor when loading the next page', async () => {
    vi.mocked(getTasksTableData).mockImplementation(async (_filters, _options, pagination) => (
      pagination.cursor
        ? { rows: [{ ...task, id: 'task-2' }], nextCursor: null }
        : { rows: [task], nextCursor: 'cursor-2' }
    ));
    const client = createTestQueryClient();
    const { result } = renderHook(
      () => useTaskTableData(
        ['tasks', 'table'],
        { staffIds: [], programIds: [], categories: [], statuses: [], search: '' },
        { key: 'dueDate', direction: 'asc' },
        '2026-08-11',
      ),
      { wrapper: createQueryClientWrapper(client) },
    );

    await waitFor(() => expect(result.current.hasNextPage).toBe(true));
    act(() => result.current.loadNextPage());
    await waitFor(() => expect(getTasksTableData).toHaveBeenLastCalledWith(
      expect.any(Object),
      { signal: expect.any(AbortSignal) },
      expect.objectContaining({ cursor: 'cursor-2' }),
    ));
  });

  it('starts a fresh server-timing query when the current date changes', async () => {
    vi.mocked(getTasksTableData).mockResolvedValue({ rows: [task], nextCursor: null });
    const client = createTestQueryClient();
    const { rerender } = renderHook(
      ({ today }) => useTaskTableData(
        ['tasks', 'table'],
        { staffIds: [], programIds: [], categories: [], statuses: ['active'], search: '' },
        { key: 'status', direction: 'asc' },
        today,
      ),
      {
        initialProps: { today: '2026-08-11' },
        wrapper: createQueryClientWrapper(client),
      },
    );

    await waitFor(() => expect(getTasksTableData).toHaveBeenCalledTimes(1));
    rerender({ today: '2026-08-12' });
    await waitFor(() => expect(getTasksTableData).toHaveBeenCalledTimes(2));
  });

  it('starts a fresh query when its base key, filters, or sorting changes', async () => {
    vi.mocked(getTasksTableData).mockResolvedValue({ rows: [task], nextCursor: null });
    const client = createTestQueryClient();
    const initialProps = {
      queryKey: ['tasks', 'table', 'first'] as readonly unknown[],
      filters: {
        staffIds: [], programIds: [], categories: [], statuses: [], search: 'workshop',
      } as Parameters<typeof useTaskTableData>[1],
      sorting: { key: 'dueDate', direction: 'asc' } as Parameters<typeof useTaskTableData>[2],
      today: '2026-08-11',
    };
    const changedFilters = { ...initialProps.filters, search: 'new' };
    const { rerender } = renderHook(
      ({ queryKey, filters, sorting, today }) => useTaskTableData(queryKey, filters, sorting, today),
      { initialProps, wrapper: createQueryClientWrapper(client) },
    );

    await waitFor(() => expect(getTasksTableData).toHaveBeenCalledTimes(1));
    rerender({ ...initialProps, queryKey: ['tasks', 'table', 'second'] });
    await waitFor(() => expect(getTasksTableData).toHaveBeenCalledTimes(2));
    rerender({ ...initialProps, queryKey: ['tasks', 'table', 'second'], filters: changedFilters });
    await waitFor(() => expect(getTasksTableData).toHaveBeenCalledTimes(3));
    rerender({
      ...initialProps,
      queryKey: ['tasks', 'table', 'second'],
      filters: changedFilters,
      sorting: { key: 'dueDate', direction: 'desc' },
    });
    await waitFor(() => expect(getTasksTableData).toHaveBeenCalledTimes(4));
  });
});
