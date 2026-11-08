import { renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { getTaskDashboardData } from '../../../../tasks.api';
import { makeTask } from '../../../../../../../tests/factories/task';
import { createQueryClientWrapper, createTestQueryClient } from '../../../../../../../tests/queryClientTestUtils';
import useTaskOverviewData from './useTaskOverviewData';
import { taskData } from '../../../../hooks/data/useTaskData';

vi.mock('../../../../tasks.api', () => ({
  getTaskDashboardData: vi.fn(),
}));

describe('useTaskOverviewData', () => {
  beforeEach(() => vi.clearAllMocks());

  it('loads tasks for the selected resource under the page-owned query key', async () => {
    const task = makeTask();
    vi.mocked(getTaskDashboardData).mockResolvedValue([task]);
    const client = createTestQueryClient();
    const { result } = renderHook(() => useTaskOverviewData(['tasks'], 'staff-1', taskData.useRecords()), {
      wrapper: createQueryClientWrapper(client),
    });

    await waitFor(() => expect(result.current.tasks).toEqual([task]));

    expect(getTaskDashboardData).toHaveBeenCalledWith(
      'staff-1',
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    );
    expect(client.getQueryData(['tasks', 'overview', 'staff-1'])).toEqual([{ id: task.id }]);
  });

  it('owns the overview error message', async () => {
    vi.mocked(getTaskDashboardData).mockRejectedValue(new Error('offline'));
    const client = createTestQueryClient();
    const { result } = renderHook(() => useTaskOverviewData(['tasks'], 'staff-1', taskData.useRecords()), {
      wrapper: createQueryClientWrapper(client),
    });

    await waitFor(() => expect(result.current.error).toBe('Unable to load task overview.'));
    expect(result.current.tasks).toEqual([]);
  });

  it('does not carry the previous resource tasks into a pending resource query', async () => {
    let resolveSecondResource: (tasks: ReturnType<typeof makeTask>[]) => void = () => undefined;
    vi.mocked(getTaskDashboardData).mockImplementation(resourceId => (
      resourceId === 'staff-1'
        ? Promise.resolve([makeTask({ id: 'task-1' })])
        : new Promise(resolve => { resolveSecondResource = resolve; })
    ));
    const client = createTestQueryClient();
    const { result, rerender } = renderHook(
      ({ resourceId }) => useTaskOverviewData(['tasks'], resourceId, taskData.useRecords()),
      {
        initialProps: { resourceId: 'staff-1' },
        wrapper: createQueryClientWrapper(client),
      },
    );

    await waitFor(() => expect(result.current.tasks).toHaveLength(1));
    rerender({ resourceId: 'staff-2' });

    expect(result.current.loading).toBe(true);
    expect(result.current.tasks).toEqual([]);

    resolveSecondResource([makeTask({ id: 'task-2' })]);
    await waitFor(() => expect(result.current.tasks[0]?.id).toBe('task-2'));
  });
});
