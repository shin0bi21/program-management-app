import { createQueryClientWrapper, createTestQueryClient } from '../../../../../tests/queryClientTestUtils';
import { taskData } from '../data/useTaskData';
import { act, renderHook as renderHookBase, waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { makeTask } from '../../../../../tests/factories/task';
import useTaskSelection from './useTaskSelection';

/**
 * Observes selection with a fresh account cache seeded with the default saved task.
 * @example renderHook(() => useTaskSelection({ resources, records: taskData.useRecords() }))
 */
function renderHook<T, P>(callback: (props: P) => T, options?: { initialProps: P }) {
  const client = createTestQueryClient();
  taskData.write(client, makeTask());
  const hook = renderHookBase(callback, { ...options, wrapper: createQueryClientWrapper(client) });
  return { ...hook, client };
}

const resources = [
  { id: 'staff-read', firstName: 'Read', lastName: 'Only', name: 'Read Only', role: 'staff', writable: false },
  { id: 'staff-1', firstName: 'Zoe', lastName: 'Wilson', name: 'Zoe Wilson', role: 'staff', writable: true },
  { id: 'staff-2', firstName: 'Ana', lastName: 'Diaz', name: 'Ana Diaz', role: 'staff', writable: true },
];

describe('useTaskSelection', () => {
  it('selects a task and clears task state when the resource changes directly', async () => {
    const task = makeTask();
    const { result } = renderHook(() => useTaskSelection({ resources, records: taskData.useRecords() }));

    await waitFor(() => expect(result.current.selectedResourceId).toBe('staff-1'));

    act(() => result.current.selectTask(task));
    expect(result.current.selectedTask).toEqual(task);
    expect(result.current.selectedTaskId).toBe(task.id);
    expect(result.current.selectedResource?.id).toBe('staff-1');

    act(() => result.current.selectResource('staff-2'));
    expect(result.current.selectedTaskId).toBeNull();
    expect(result.current.selectedTask).toBeNull();
    expect(result.current.selectedResource?.id).toBe('staff-2');
  });

  it('follows reassignment from a shared read without a separate selection synchronization callback', async () => {
    const task = makeTask();
    const updated = makeTask({
      title: 'Updated workshop',
      staffId: 'staff-2', firstName: 'Alex', lastName: 'Smith', name: 'Alex Smith',
    });
    const { result, client } = renderHook(() => useTaskSelection({ resources, records: taskData.useRecords() }));

    await waitFor(() => expect(result.current.selectedResourceId).toBe('staff-1'));

    act(() => result.current.selectTask(task));
    act(() => taskData.finishRead(
      client, taskData.beginRead(client), [updated], new AbortController().signal,
    ));
    await waitFor(() => expect(result.current.selectedTask).toEqual(updated));
    expect(result.current.selectedResource?.id).toBe('staff-2');

    act(() => result.current.removeSelectedTask(task.id));
    expect(result.current.selectedTask).toBeNull();
  });

  it('falls back to a valid readable resource when options change', async () => {
    const { result, rerender } = renderHook(
      ({ currentResources }) => useTaskSelection({ resources: currentResources, records: taskData.useRecords() }),
      { initialProps: { currentResources: resources } },
    );

    await waitFor(() => expect(result.current.selectedResourceId).toBe('staff-1'));
    act(() => result.current.selectTask(makeTask()));

    rerender({ currentResources: [resources[0]] });

    await waitFor(() => expect(result.current.selectedResourceId).toBe('staff-read'));
    expect(result.current.selectedResource?.name).toBe('Read Only');
    expect(result.current.selectedTask).toBeNull();
  });
});
