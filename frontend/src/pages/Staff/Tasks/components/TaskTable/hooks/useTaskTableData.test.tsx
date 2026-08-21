// Scope: verifies task-table control serialization and cursor-page accumulation.
import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { getTaskList } from '../../../../../../common/features/tasks/tasks.api';
import { makeTask } from '../../../../../../tests/factories/task';
import { createQueryClientWrapper, createTestQueryClient } from '../../../../../../tests/queryClientTestUtils';
import useTaskTableData from './useTaskTableData';

vi.mock('../../../../../../common/features/tasks/tasks.api', () => ({ getTaskList: vi.fn() }));

const task = makeTask();

describe('useTaskTableData', () => {
  beforeEach(() => vi.clearAllMocks());

  it('sends every table control through the cursor API', async () => {
    vi.mocked(getTaskList).mockResolvedValue({ rows: [task], nextCursor: null });
    const client = createTestQueryClient();
    const filters = {
      staffIds: ['staff-1'], programIds: ['program-1'], categories: ['planning_prep' as const],
      statuses: ['active' as const], search: ' workshop ',
    };
    const sorting = { key: 'dueDate' as const, direction: 'asc' as const };
    const { result } = renderHook(
      () => useTaskTableData(['tasks', 'table'], filters, sorting, '2026-08-11'),
      { wrapper: createQueryClientWrapper(client) },
    );

    await waitFor(() => expect(result.current.rows).toEqual([task]));
    expect(result.current.appliedSearch).toBe(' workshop ');
    expect(getTaskList).toHaveBeenCalledWith(
      { ...filters, search: ' workshop ' },
      { signal: expect.any(AbortSignal) },
      { ...sorting, cursor: undefined, limit: 25 },
    );
  });

  it('appends the next cursor page', async () => {
    vi.mocked(getTaskList).mockImplementation(async (_filters, _options, pagination) => (
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

    await waitFor(() => expect(result.current.rows).toEqual([task]));
    act(() => result.current.loadNextPage());
    await waitFor(() => expect(result.current.rows.map(item => item.id)).toEqual(['task-1', 'task-2']));
    expect(getTaskList).toHaveBeenLastCalledWith(
      expect.any(Object), { signal: expect.any(AbortSignal) }, expect.objectContaining({ cursor: 'cursor-2' }),
    );
  });

  it('starts a fresh server-timing query when the current date changes', async () => {
    vi.mocked(getTaskList).mockResolvedValue({ rows: [task], nextCursor: null });
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

    await waitFor(() => expect(getTaskList).toHaveBeenCalledTimes(1));
    rerender({ today: '2026-08-12' });
    await waitFor(() => expect(getTaskList).toHaveBeenCalledTimes(2));
  });
});
