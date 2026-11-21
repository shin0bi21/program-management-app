import { renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { getOpenTasks } from '../../../../api/tasks.api';
import { makeTask } from '../../../../../../../tests/factories/task';
import { createQueryClientWrapper, createTestQueryClient } from '../../../../../../../tests/queryClientTestUtils';
import useTaskOverviewData from './useTaskOverviewData';

vi.mock('../../../../api/tasks.api', () => ({
  getOpenTasks: vi.fn(),
}));

describe('useTaskOverviewData', () => {
  beforeEach(() => vi.clearAllMocks());

  it('does not request tasks without selected staff', () => {
    const client = createTestQueryClient();
    renderHook(() => useTaskOverviewData(['tasks'], null), {
      wrapper: createQueryClientWrapper(client),
    });

    expect(getOpenTasks).not.toHaveBeenCalled();
  });

  it('loads tasks for the selected staff member under the page-owned query key', async () => {
    const task = makeTask();
    vi.mocked(getOpenTasks).mockResolvedValue([task]);
    const client = createTestQueryClient();
    renderHook(() => useTaskOverviewData(['tasks'], 'staff-1'), {
      wrapper: createQueryClientWrapper(client),
    });

    await waitFor(() => expect(client.getQueryData(['tasks', 'overview', 'staff-1'])).toEqual([task]));

    expect(getOpenTasks).toHaveBeenCalledWith(
      'staff-1',
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    );
  });

  it('owns the overview error message', async () => {
    vi.mocked(getOpenTasks).mockRejectedValue(new Error('offline'));
    const client = createTestQueryClient();
    const { result } = renderHook(() => useTaskOverviewData(['tasks'], 'staff-1'), {
      wrapper: createQueryClientWrapper(client),
    });

    await waitFor(() => expect(result.current.error).toBe('Unable to load task overview.'));
    expect(result.current.tasks).toEqual([]);
  });

  it('does not carry the previous staff member’s tasks into a pending staff query', async () => {
    let resolveSecondStaff: (tasks: ReturnType<typeof makeTask>[]) => void = () => undefined;
    vi.mocked(getOpenTasks).mockImplementation(staffId => (
      staffId === 'staff-1'
        ? Promise.resolve([makeTask({ id: 'task-1' })])
        : new Promise(resolve => { resolveSecondStaff = resolve; })
    ));
    const client = createTestQueryClient();
    const { result, rerender } = renderHook(
      ({ staffId }) => useTaskOverviewData(['tasks'], staffId),
      {
        initialProps: { staffId: 'staff-1' },
        wrapper: createQueryClientWrapper(client),
      },
    );

    await waitFor(() => expect(result.current.tasks).toHaveLength(1));
    rerender({ staffId: 'staff-2' });

    expect(result.current.loading).toBe(true);
    expect(result.current.tasks).toEqual([]);

    resolveSecondStaff([makeTask({ id: 'task-2' })]);
    await waitFor(() => expect(result.current.tasks[0]?.id).toBe('task-2'));
  });
});
