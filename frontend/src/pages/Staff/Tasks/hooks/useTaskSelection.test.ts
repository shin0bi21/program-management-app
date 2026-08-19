// Scope: verifies cross-view task/resource selection and action synchronization.
import { act, renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { makeTask } from '../../../../tests/factories/task';
import useTaskSelection from './useTaskSelection';

describe('useTaskSelection', () => {
  it('selects a task and clears task state when the resource changes directly', () => {
    const onResourceSelect = vi.fn();
    const task = makeTask();
    const { result } = renderHook(() => useTaskSelection({ onResourceSelect }));

    act(() => result.current.selectTask(task));
    expect(result.current.selectedTask).toEqual(task);
    expect(result.current.selectedTaskId).toBe(task.id);
    expect(onResourceSelect).toHaveBeenCalledWith('staff-1');

    act(() => result.current.selectResource('staff-2'));
    expect(result.current.selectedTaskId).toBeNull();
    expect(result.current.selectedTask).toBeNull();
    expect(onResourceSelect).toHaveBeenLastCalledWith('staff-2');
  });

  it('synchronizes completed actions with the selected task', () => {
    const task = makeTask();
    const updated = makeTask({
      title: 'Updated workshop',
      assignee: { id: 'staff-2', firstName: 'Alex', lastName: 'Smith', name: 'Alex Smith' },
    });
    const onResourceSelect = vi.fn();
    const { result } = renderHook(() => useTaskSelection({ onResourceSelect }));

    act(() => result.current.selectTask(task));
    act(() => result.current.updateSelectedTask(updated));
    expect(result.current.selectedTask).toEqual(updated);
    expect(onResourceSelect).toHaveBeenLastCalledWith('staff-2');

    act(() => result.current.removeSelectedTask(task.id));
    expect(result.current.selectedTask).toBeNull();
  });
});
