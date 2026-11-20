import { renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import useInfiniteListQuery from '../../../../../../query/hooks/useInfiniteListQuery';
import { getTasksTableData } from '../api/taskTable.api';
import useTaskTableData from './useTaskTableData';

vi.mock('../../../../../../query/hooks/useInfiniteListQuery', () => ({
  default: vi.fn(() => ({ rows: [] })),
}));
vi.mock('../api/taskTable.api', () => ({ getTasksTableData: vi.fn() }));

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

  it('keys the applied controls and forwards the domain request', async () => {
    renderHook(() => useTaskTableData(['tasks', 'table'], filters, sorting, '2026-08-11'));
    const options = vi.mocked(useInfiniteListQuery).mock.lastCall![0];
    const signal = new AbortController().signal;

    expect(options.queryKey).toEqual(['tasks', 'table', filters, sorting, '2026-08-11']);
    await options.queryFn({ signal, pageParam: 'cursor-2' } as Parameters<typeof options.queryFn>[0]);
    expect(getTasksTableData).toHaveBeenLastCalledWith(
      filters, { signal }, { ...sorting, cursor: 'cursor-2' },
    );
  });
});
