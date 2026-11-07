import { taskStore } from '../../../taskStore';
import { makeTask } from '../../../../../../tests/factories/task';
import { createQueryClientWrapper, createTestQueryClient } from '../../../../../../tests/queryClientTestUtils';
import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import useInfiniteListQuery from '../../../../../../query/hooks/useInfiniteListQuery';
import { TABLE_PAGE_SIZE } from '../../../../../../query/types';
import { getTasksTableData } from '../../../tasks.api';
import useTaskTableData from './useTaskTableData';

vi.mock('../../../../../../query/hooks/useInfiniteListQuery', () => ({
  default: vi.fn(() => ({ rows: [] })),
}));
vi.mock('../../../tasks.api', () => ({ getTasksTableData: vi.fn() }));

const filters = {
  cycleIds: ['cycle-1'],
  staffIds: ['staff-1'], programIds: ['program-1'], categories: ['planning_prep' as const],
  statuses: ['in_progress' as const], search: 'workshop',
};
const sorting = { key: 'dueDate' as const, direction: 'asc' as const };

describe('useTaskTableData', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getTasksTableData).mockResolvedValue({ rows: [], nextCursor: null });
  });

  it('passes table controls to the query owner and forwards initial and next-page API inputs', async () => {
    const client = createTestQueryClient();
    const task = makeTask();
    vi.mocked(getTasksTableData).mockResolvedValue({ rows: [task], nextCursor: 'next' });
    renderHook(() => useTaskTableData(['tasks', 'table'], filters, sorting, '2026-08-11'), { wrapper: createQueryClientWrapper(client) });
    const options = vi.mocked(useInfiniteListQuery).mock.lastCall![0];
    const signal = new AbortController().signal;

    expect(options.queryKey).toEqual(['tasks', 'table', filters, sorting, '2026-08-11']);
    await act(async () => {
      const page = await options.queryFn({ signal, pageParam: null } as Parameters<typeof options.queryFn>[0]);
      expect(page).toEqual({ rows: [{ id: task.id, sortValue: task.dueDate }], nextCursor: 'next' });
    });
    expect(taskStore.get(client, task.id)).toEqual(task);
    expect(getTasksTableData).toHaveBeenLastCalledWith(
      filters, { signal }, { ...sorting, cursor: undefined, limit: TABLE_PAGE_SIZE },
    );

    await act(async () => { await options.queryFn({ signal, pageParam: 'cursor-2' } as Parameters<typeof options.queryFn>[0]); });
    expect(getTasksTableData).toHaveBeenLastCalledWith(
      filters, { signal }, { ...sorting, cursor: 'cursor-2', limit: TABLE_PAGE_SIZE },
    );
  });

});
