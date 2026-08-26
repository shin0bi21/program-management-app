// Scope: verifies create/edit initialization, submission routing, and error lifecycle.
import type { FormEvent } from 'react';
import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { setTask } from '../../../tasks.api';
import { makeTask } from '../../../../../../tests/factories/task';
import useTaskModal from './useTaskModal';

vi.mock('../../../tasks.api', () => ({
  setTask: vi.fn(),
}));

const submitEvent = {
  preventDefault: vi.fn(),
} as unknown as FormEvent<HTMLFormElement>;

describe('useTaskModal', () => {
  beforeEach(() => vi.clearAllMocks());

  it('initializes and submits a new task before synchronizing its success state', async () => {
    const savedTask = makeTask();
    vi.mocked(setTask).mockResolvedValue(savedTask);
    const onSaved = vi.fn();
    const { result } = renderHook(() => useTaskModal({
      target: {
        mode: 'add',
        initialValues: {
          startDate: '2026-08-10',
          dueDate: '2026-08-14',
          staffId: 'staff-1',
        },
      },
      onSaved,
    }));

    act(() => {
      result.current.updateDraft('title', '  Prepare workshop  ');
      result.current.updateDraft('details', '  Draft materials  ');
      result.current.updateDraft('category', 'outreach');
      result.current.updateDraft('programId', 'program-1');
    });
    await act(() => result.current.submit(submitEvent));

    expect(setTask).toHaveBeenCalledWith({
      title: 'Prepare workshop',
      details: 'Draft materials',
      category: 'outreach',
      programId: 'program-1',
      startDate: '2026-08-10',
      dueDate: '2026-08-14',
      staffId: 'staff-1',
    }, undefined);
    expect(onSaved).toHaveBeenCalledWith(savedTask);
    expect(result.current.status).toBe('success');
    expect(result.current.statusMessage).toBe('Task created.');
    expect(result.current.submissionComplete).toBe(true);
  });

  it('initializes an existing task and submits its update by id', async () => {
    const task = makeTask({
      id: 'task-1',
      title: 'Existing task',
      startDate: '2026-08-10',
      dueDate: '2026-08-14',
    });
    vi.mocked(setTask).mockResolvedValue(task);
    const { result } = renderHook(() => useTaskModal({
      target: { mode: 'edit', task },
      onSaved: vi.fn(),
    }));

    expect(result.current.draft.title).toBe('Existing task');
    await act(() => result.current.submit(submitEvent));

    expect(setTask).toHaveBeenCalledWith(expect.objectContaining({
      title: 'Existing task',
      staffId: task.assignee.id,
    }), 'task-1');
  });

  it('moves the due date with a newly selected start date', () => {
    const { result } = renderHook(() => useTaskModal({
      target: {
        mode: 'add',
        initialValues: {
          startDate: '2026-08-10',
          dueDate: '2026-08-14',
          staffId: 'staff-1',
        },
      },
      onSaved: vi.fn(),
    }));

    act(() => result.current.updateStartDate('2026-09-20'));

    expect(result.current.draft.startDate).toBe('2026-09-20');
    expect(result.current.draft.dueDate).toBe('2026-09-20');
  });

  it('requires an explicit category before creating a task', async () => {
    const { result } = renderHook(() => useTaskModal({
      target: {
        mode: 'add',
        initialValues: { startDate: '2026-08-10', dueDate: '2026-08-10', staffId: 'staff-1' },
      },
      onSaved: vi.fn(),
    }));

    await act(() => result.current.submit(submitEvent));

    expect(setTask).not.toHaveBeenCalled();
    expect(result.current.status).toBe('error');
    expect(result.current.statusMessage).toBe('Select a category.');
  });

  it('keeps the modal open and presents a submission error', async () => {
    vi.mocked(setTask).mockRejectedValue(null);
    const onSaved = vi.fn();
    const { result } = renderHook(() => useTaskModal({
      target: {
        mode: 'add',
        initialValues: {
          startDate: '2026-08-10',
          dueDate: '2026-08-10',
          staffId: 'staff-1',
        },
      },
      onSaved,
    }));

    act(() => result.current.updateDraft('category', 'outreach'));

    await act(() => result.current.submit(submitEvent));
    await waitFor(() => expect(result.current.status).toBe('error'));

    expect(result.current.statusMessage).toBe('Unable to create task');
    expect(onSaved).not.toHaveBeenCalled();

    const savedTask = makeTask();
    vi.mocked(setTask).mockResolvedValue(savedTask);
    await act(() => result.current.submit(submitEvent));
    expect(onSaved).toHaveBeenCalledWith(savedTask);
    expect(result.current.status).toBe('success');
  });

  it('ignores a repeated submission while the current request is pending', async () => {
    const savedTask = makeTask();
    let resolveSave: (task: typeof savedTask) => void = () => undefined;
    vi.mocked(setTask).mockReturnValue(new Promise(resolve => { resolveSave = resolve; }));
    const onSaved = vi.fn();
    const { result } = renderHook(() => useTaskModal({
      target: {
        mode: 'add',
        initialValues: {
          startDate: '2026-08-10',
          dueDate: '2026-08-10',
          staffId: 'staff-1',
        },
      },
      onSaved,
    }));

    act(() => {
      result.current.updateDraft('title', 'Prepare workshop');
      result.current.updateDraft('category', 'outreach');
    });
    act(() => {
      void result.current.submit(submitEvent);
      void result.current.submit(submitEvent);
    });

    expect(setTask).toHaveBeenCalledOnce();
    expect(result.current.status).toBe('submitting');

    await act(async () => resolveSave(savedTask));
    expect(onSaved).toHaveBeenCalledOnce();
    expect(result.current.status).toBe('success');
  });
});
