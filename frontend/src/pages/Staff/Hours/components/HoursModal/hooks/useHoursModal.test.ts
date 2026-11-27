import type { FormEvent } from 'react';
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

const staff = [
  { id: 'staff-1', firstName: 'Zoe', lastName: 'Wilson', name: 'Zoe Wilson', role: 'staff', writable: true },
  { id: 'staff-2', firstName: 'Alex', lastName: 'Morgan', name: 'Alex Morgan', role: 'staff', writable: true },
] as const;
const programs = [{ id: 'program-1', title: 'Soft Skills' }];

function renderWorkflow(overrides: Partial<UseHoursModalOptions> = {}) {
  const options: UseHoursModalOptions = {
    staff,
    programs,
    loadTasks,
    onAdd: vi.fn().mockResolvedValue(undefined),
    staffId: 'staff-1',
    date: '2026-08-19',
    ...overrides,
  };
  const queryClient = createTestQueryClient();
  const hook = renderHook(() => useHoursModal(options), {
    wrapper: createQueryClientWrapper(queryClient),
  });
  return { ...hook, options };
}

function submitEvent() {
  return { preventDefault: vi.fn() } as unknown as FormEvent;
}

describe('useHoursModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    loadTasks.mockResolvedValue([]);
    vi.mocked(getHoursSessions).mockResolvedValue([]);
  });

  it('defaults the work date to today when no date is supplied', () => {
    const date = getDate();
    const { result } = renderWorkflow({ date: undefined });

    expect(result.current.draft.date).toBe(date);
  });

  it('owns regular-time field transitions and reaches success after the command', async () => {
    const onAdd = vi.fn().mockResolvedValue(undefined);
    const { result } = renderWorkflow({ onAdd });

    act(() => {
      result.current.selectProgram('program-1');
      result.current.selectCategory('meeting');
      result.current.updateHours('2.5');
      result.current.updateNote('  Team planning  ');
    });
    await act(async () => result.current.submit(submitEvent()));

    expect(onAdd).toHaveBeenCalledWith({
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
    const onAdd = vi.fn().mockResolvedValue(undefined);
    const item = makeHoursItem({ note: '  Stored note  ', hours: 1 });
    const { result } = renderWorkflow({ item, onAdd });

    act(() => result.current.updateHours('2'));
    await act(async () => result.current.submit(submitEvent()));

    expect(onAdd).toHaveBeenCalledExactlyOnceWith({ hours: 2 }, false);
  });

  it('loads only open task options and submits the task command', async () => {
    const task = makeTask();
    loadTasks.mockResolvedValue([
      task,
      makeTask({ id: 'task-complete', state: 'completed', status: 'completed', statusLabel: 'Completed' }),
    ]);
    const onAdd = vi.fn().mockResolvedValue(undefined);
    const { result } = renderWorkflow({
      type: 'task',
      canCompleteTask: true,
      onAdd,
    });

    await waitFor(() => expect(result.current.taskOptions).toEqual([task]));
    act(() => {
      result.current.selectTask(task.id);
      result.current.updateHours('1');
      result.current.setCompleteTask(true);
      result.current.updateNote('Prepared materials');
    });
    await act(async () => result.current.submit(submitEvent()));

    expect(onAdd).toHaveBeenCalledWith({
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
    const onAdd = vi.fn().mockResolvedValue(undefined);
    const { result } = renderWorkflow({ type: 'task', onAdd });

    await waitFor(() => expect(result.current.taskOptions).toEqual([task]));
    act(() => {
      result.current.selectTask(task.id);
      result.current.updateHours('1');
      result.current.setCompleteTask(true);
      result.current.updateNote('Logged without completion permission');
    });
    await act(async () => result.current.submit(submitEvent()));

    expect(onAdd).toHaveBeenCalledWith(expect.objectContaining({
      type: 'task',
    }), false);
  });

  it('reloads sessions by staff and date before submitting the selected session', async () => {
    vi.mocked(getHoursSessions).mockResolvedValue([{
      id: 'session-1',
      title: 'Leadership',
      date: '2026-08-20',
    }]);
    const onAdd = vi.fn().mockResolvedValue(undefined);
    const { result } = renderWorkflow({ type: 'session', onAdd });

    await waitFor(() => expect(result.current.sessionOptions).toHaveLength(1));
    act(() => {
      result.current.selectSession('session-1');
      result.current.updateHours('1');
      result.current.updateNote('Led session');
    });
    await act(async () => result.current.submit(submitEvent()));

    expect(onAdd).toHaveBeenCalledWith({
      type: 'session',
      staffId: 'staff-1',
      sessionId: 'session-1',
      hours: 1,
      note: 'Led session',
    }, false);
  });

  it('rejects direct form submission when required command data is invalid', async () => {
    const onAdd = vi.fn().mockResolvedValue(undefined);
    const { result } = renderWorkflow({ type: 'task', onAdd });

    act(() => {
      result.current.updateHours('not-a-number');
      result.current.updateNote('Prepared materials');
    });
    await act(async () => result.current.submit(submitEvent()));

    expect(onAdd).not.toHaveBeenCalled();
    expect(result.current.submitStatus).toBe('error');
    expect(result.current.error).toBe('Select a task.');

    act(() => result.current.selectTask('task-1'));
    await act(async () => result.current.submit(submitEvent()));

    expect(onAdd).not.toHaveBeenCalled();
    expect(result.current.error).toBe('Hours must be between 0.25 and 24.');
  });
});
