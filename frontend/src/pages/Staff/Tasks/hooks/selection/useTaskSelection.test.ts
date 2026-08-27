// Owns cross-view task/resource selection and action synchronization.
import { act, renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { makeTask } from '../../../../../tests/factories/task';
import useTaskSelection from './useTaskSelection';

const resources = [
  { id: 'staff-read', firstName: 'Read', lastName: 'Only', name: 'Read Only', role: 'staff', writable: false },
  { id: 'staff-1', firstName: 'Zoe', lastName: 'Wilson', name: 'Zoe Wilson', role: 'staff', writable: true },
  { id: 'staff-2', firstName: 'Ana', lastName: 'Diaz', name: 'Ana Diaz', role: 'staff', writable: true },
];

describe('useTaskSelection', () => {
  it('selects a task and clears task state when the resource changes directly', async () => {
    const task = makeTask();
    const { result } = renderHook(() => useTaskSelection({ resources }));

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

  it('synchronizes completed actions with the selected task', async () => {
    const task = makeTask();
    const updated = makeTask({
      title: 'Updated workshop',
      assignee: { id: 'staff-2', firstName: 'Alex', lastName: 'Smith', name: 'Alex Smith' },
    });
    const { result } = renderHook(() => useTaskSelection({ resources }));

    await waitFor(() => expect(result.current.selectedResourceId).toBe('staff-1'));

    act(() => result.current.selectTask(task));
    act(() => result.current.updateSelectedTask(updated));
    expect(result.current.selectedTask).toEqual(updated);
    expect(result.current.selectedResource?.id).toBe('staff-2');

    act(() => result.current.removeSelectedTask(task.id));
    expect(result.current.selectedTask).toBeNull();
  });

  it('falls back to a valid readable resource when options change', async () => {
    const { result, rerender } = renderHook(
      ({ currentResources }) => useTaskSelection({ resources: currentResources }),
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
