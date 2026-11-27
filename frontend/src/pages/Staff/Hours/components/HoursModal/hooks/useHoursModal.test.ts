import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { makeTask } from '../../../../../../tests/factories/task';
import { makeHoursItem } from '../../../../../../tests/factories/hours';
import { createQueryClientWrapper, createTestQueryClient } from '../../../../../../tests/queryClientTestUtils';
import { getHoursSessions } from '../../../hours.api';
import useHoursModal, { type UseHoursModalOptions } from './useHoursModal';
import { getDate } from '../../../../../../common/utils/date';

vi.mock('../../../hours.api', () => ({ getHoursSessions: vi.fn() }));

const loadTasks = vi.fn();

const addContext = { staffId: 'staff-1', date: '2026-08-19' };

function renderWorkflow(overrides: Partial<UseHoursModalOptions> = {}) {
  const options: UseHoursModalOptions = {
    target: { mode: 'add', context: addContext },
    loadTasks,
    onSave: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
  const queryClient = createTestQueryClient();
  const hook = renderHook(() => useHoursModal(options), {
    wrapper: createQueryClientWrapper(queryClient),
  });
  return { ...hook, options };
}

describe('useHoursModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    loadTasks.mockResolvedValue([]);
    vi.mocked(getHoursSessions).mockResolvedValue([]);
  });

  it('defaults the work date to today when no date is supplied', () => {
    const date = getDate();
    const { result } = renderWorkflow({ target: { mode: 'add', context: { staffId: 'staff-1' } } });

    expect(result.current.draft.date).toBe(date);
  });

  it('owns regular-time field transitions and reaches success after the command', async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    const { result } = renderWorkflow({ onSave });

    act(() => {
      result.current.setValue('programId', 'program-1');
      result.current.setValue('category', 'meeting');
      result.current.setValue('hours', '2.5');
      result.current.setValue('note', '  Team planning  ');
    });
    await act(async () => result.current.submit());

    expect(onSave).toHaveBeenCalledWith({
      type: 'regular',
      staffId: 'staff-1',
      date: '2026-08-19',
      programId: 'program-1',
      category: 'meeting',
      hours: 2.5,
      note: '  Team planning  ',
    }, false);
    expect(result.current.submitStatus).toBe('success');
  });

  it('sends only changed fields when editing an existing entry', async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    const item = makeHoursItem({ note: '  Stored note  ', hours: 1 });
    const { result } = renderWorkflow({ target: { mode: 'edit', item }, onSave });

    act(() => result.current.setValue('hours', '2'));
    await act(async () => result.current.submit());

    expect(onSave).toHaveBeenCalledExactlyOnceWith({ hours: 2 }, false);
  });

  it('loads only open task options and submits the task command', async () => {
    const task = makeTask();
    loadTasks.mockResolvedValue([
      task,
      makeTask({ id: 'task-complete', state: 'completed', status: 'completed', statusLabel: 'Completed' }),
    ]);
    const onSave = vi.fn().mockResolvedValue(undefined);
    const { result } = renderWorkflow({
      target: { mode: 'add', context: { ...addContext, type: 'task' } },
      canCompleteTask: true,
      onSave,
    });

    await waitFor(() => expect(result.current.taskOptions).toEqual([task]));
    act(() => {
      result.current.setValue('taskId', task.id);
      result.current.setValue('hours', '1');
      result.current.setValue('completeTask', true);
      result.current.setValue('note', 'Prepared materials');
    });
    await act(async () => result.current.submit());

    expect(onSave).toHaveBeenCalledWith({
      type: 'task',
      staffId: 'staff-1',
      date: '2026-08-19',
      taskId: 'task-1',
      hours: 1,
      note: 'Prepared materials',
    }, true);
  });

  it('does not send task completion without task-write capability', async () => {
    const task = makeTask();
    loadTasks.mockResolvedValue([task]);
    const onSave = vi.fn().mockResolvedValue(undefined);
    const { result } = renderWorkflow({ target: { mode: 'add', context: { ...addContext, type: 'task' } }, onSave });

    await waitFor(() => expect(result.current.taskOptions).toEqual([task]));
    act(() => {
      result.current.setValue('taskId', task.id);
      result.current.setValue('hours', '1');
      result.current.setValue('completeTask', true);
      result.current.setValue('note', 'Logged without completion permission');
    });
    await act(async () => result.current.submit());

    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({
      type: 'task',
    }), false);
  });

  it('reloads sessions by staff and date before submitting the selected session', async () => {
    vi.mocked(getHoursSessions).mockResolvedValue([{
      id: 'session-1',
      title: 'Leadership',
      date: '2026-08-20',
    }]);
    const onSave = vi.fn().mockResolvedValue(undefined);
    const { result } = renderWorkflow({ target: { mode: 'add', context: { ...addContext, type: 'session' } }, onSave });

    await waitFor(() => expect(result.current.sessionOptions).toHaveLength(1));
    act(() => {
      result.current.selectSession('session-1');
      result.current.setValue('hours', '1');
      result.current.setValue('note', 'Led session');
    });
    await act(async () => result.current.submit());

    expect(onSave).toHaveBeenCalledWith({
      type: 'session',
      staffId: 'staff-1',
      sessionId: 'session-1',
      hours: 1,
      note: 'Led session',
    }, false);
  });

  it('rejects direct form submission when required command data is invalid', async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    const { result } = renderWorkflow({ target: { mode: 'add', context: { ...addContext, type: 'task' } }, onSave });

    act(() => {
      result.current.setValue('hours', 'not-a-number');
      result.current.setValue('note', 'Prepared materials');
    });
    await act(async () => result.current.submit());

    expect(onSave).not.toHaveBeenCalled();
    expect(result.current.submitStatus).toBe('error');
    expect(result.current.error).toBe('Select a task.');

    act(() => result.current.setValue('taskId', 'task-1'));
    await act(async () => result.current.submit());

    expect(onSave).not.toHaveBeenCalled();
    expect(result.current.error).toBe('Hours must be between 0.25 and 24.');
  });
});
