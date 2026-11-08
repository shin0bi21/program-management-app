import { makeTask } from '../../../../../../tests/factories/task';
import { createQueryClientWrapper, createTestQueryClient } from '../../../../../../tests/queryClientTestUtils';
import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import useInfiniteListQuery from '../../../../../../query/hooks/useInfiniteListQuery';
import { TABLE_PAGE_SIZE } from '../../../../../../query/types';
import { getTasksTableData } from '../../../tasks.api';
import useTaskTableData, { getTaskSortValue } from './useTaskTableData';
import type { Task, TaskSortKey } from '../../../types';

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
      expect(page).toEqual({ rows: [task], nextCursor: 'next' });
    });
    expect(getTasksTableData).toHaveBeenLastCalledWith(
      filters, { signal }, { ...sorting, cursor: undefined, limit: TABLE_PAGE_SIZE },
    );

    await act(async () => { await options.queryFn({ signal, pageParam: 'cursor-2' } as Parameters<typeof options.queryFn>[0]); });
    expect(getTasksTableData).toHaveBeenLastCalledWith(
      filters, { signal }, { ...sorting, cursor: 'cursor-2', limit: TABLE_PAGE_SIZE },
    );
  });

});

const row = makeTask();

const sortValues: Array<[TaskSortKey, Partial<Task>, string]> = [
  ['firstName', { firstName: 'Other' }, 'other'],
  ['lastName', { lastName: 'Other' }, 'other'],
  ['title', { title: 'Other' }, 'other'],
  ['category', { category: 'meeting' }, 'meeting'],
  ['program', { program: 'Other' }, 'other'],
  ['startDate', { startDate: '2027-01-01' }, '2027-01-01'],
  ['dueDate', { dueDate: '2027-01-01' }, '2027-01-01'],
  ['status', { status: 'cancelled' }, 'cancelled'],
];

it.each(sortValues)('maps %s to its canonical sort value', (key, changes, expected) => {
  expect(getTaskSortValue({ ...row, ...changes }, key)).toEqual(expected);
});
