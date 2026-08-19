// Scope: verifies task-list control serialization and cursor-page accumulation.
import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { getTaskList } from '../../../../../../common/features/tasks/api/tasks.api';
import { makeTask } from '../../../../../../tests/factories/task';
import { createQueryClientWrapper, createTestQueryClient } from '../../../../../../tests/queryClientTestUtils';
import useTaskList from './useTaskList';

vi.mock('../../../../../../common/features/tasks/api/tasks.api', () => ({ getTaskList: vi.fn() }));

const task = makeTask();

describe('useTaskList', () => {
  beforeEach(() => vi.clearAllMocks());

  it('sends every list control through the cursor API', async () => {
    vi.mocked(getTaskList).mockResolvedValue({ rows: [task], nextCursor: null });
    const client = createTestQueryClient();
    const filters = {
      staffIds: ['staff-1'], programIds: ['program-1'], categories: ['planning_prep' as const],
      statuses: ['todo' as const], search: ' workshop ',
    };
    const sorting = { key: 'dueDate' as const, direction: 'asc' as const };
    const { result } = renderHook(
      () => useTaskList(['tasks', 'list'], filters, sorting, true),
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
      () => useTaskList(
        ['tasks', 'list'],
        { staffIds: [], programIds: [], categories: [], statuses: [], search: '' },
        { key: 'dueDate', direction: 'asc' },
        true,
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
});
