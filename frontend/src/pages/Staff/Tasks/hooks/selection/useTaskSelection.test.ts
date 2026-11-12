import { act, renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { makeTask } from '../../../../../tests/factories/task';
import useTaskSelection from './useTaskSelection';

const staff = [
  { id: 'staff-read', firstName: 'Read', lastName: 'Only', name: 'Read Only', role: 'staff', writable: false },
  { id: 'staff-1', firstName: 'Zoe', lastName: 'Wilson', name: 'Zoe Wilson', role: 'staff', writable: true },
  { id: 'staff-2', firstName: 'Ana', lastName: 'Diaz', name: 'Ana Diaz', role: 'staff', writable: true },
];

describe('useTaskSelection', () => {
  it('selects a task and clears task state when the staff member changes directly', async () => {
    const task = makeTask();
    const { result } = renderHook(() => useTaskSelection({ staff }));

    await waitFor(() => expect(result.current.selectedStaffId).toBe('staff-1'));

    act(() => result.current.selectTask(task));
    expect(result.current.selectedTask).toEqual(task);
    expect(result.current.selectedTaskId).toBe(task.id);
    expect(result.current.selectedStaff?.id).toBe('staff-1');

    act(() => result.current.selectStaff('staff-2'));
    expect(result.current.selectedTaskId).toBeNull();
    expect(result.current.selectedTask).toBeNull();
    expect(result.current.selectedStaff?.id).toBe('staff-2');
  });

  it('follows reassignment after a successful task action synchronizes the selection', async () => {
    const task = makeTask();
    const updated = makeTask({
      title: 'Updated workshop',
      staffId: 'staff-2', firstName: 'Alex', lastName: 'Smith', name: 'Alex Smith',
    });
    const { result } = renderHook(() => useTaskSelection({ staff }));

    await waitFor(() => expect(result.current.selectedStaffId).toBe('staff-1'));

    act(() => result.current.selectTask(task));
    act(() => result.current.onTaskSynced(updated));
    await waitFor(() => expect(result.current.selectedTask).toEqual(updated));
    expect(result.current.selectedStaff?.id).toBe('staff-2');

    act(() => result.current.removeSelectedTask(task.id));
    expect(result.current.selectedTask).toBeNull();
  });

  it('falls back to a valid readable staff member when options change', async () => {
    const { result, rerender } = renderHook(
      ({ currentStaff }) => useTaskSelection({ staff: currentStaff }),
      { initialProps: { currentStaff: staff } },
    );

    await waitFor(() => expect(result.current.selectedStaffId).toBe('staff-1'));
    act(() => result.current.selectTask(makeTask()));

    rerender({ currentStaff: [staff[0]] });

    await waitFor(() => expect(result.current.selectedStaffId).toBe('staff-read'));
    expect(result.current.selectedStaff?.name).toBe('Read Only');
    expect(result.current.selectedTask).toBeNull();
  });
});
