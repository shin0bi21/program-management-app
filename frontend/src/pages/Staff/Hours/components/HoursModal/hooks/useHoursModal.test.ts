import type { FormEvent } from 'react';
import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { makeTask } from '../../../../../../tests/factories/task';
import { createQueryClientWrapper, createTestQueryClient } from '../../../../../../tests/queryClientTestUtils';
import { getHoursSessions } from '../../../hours.api';
import useHoursModal, { type UseHoursModalOptions } from './useHoursModal';

vi.mock('../../../hours.api', () => ({ getHoursSessions: vi.fn() }));

const loadTasks = vi.fn();

const resources = [
  { id: 'staff-1', firstName: 'Zoe', lastName: 'Wilson', name: 'Zoe Wilson', role: 'staff', writable: true },
  { id: 'staff-2', firstName: 'Alex', lastName: 'Morgan', name: 'Alex Morgan', role: 'staff', writable: true },
] as const;
const programs = [{ id: 'program-1', name: 'Soft Skills' }];

function renderWorkflow(overrides: Partial<UseHoursModalOptions> = {}) {
  const options: UseHoursModalOptions = {
    isOpen: true,
    resources,
    programs,
    loadTasks,
    onAdd: vi.fn().mockResolvedValue(undefined),
    initialDate: '2026-08-19',
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
      source: 'regular',
      staffId: 'staff-1',
      workDate: '2026-08-19',
      programId: 'program-1',
      category: 'meeting',
      hours: 2.5,
      note: 'Team planning',
    });
    expect(result.current.submitStatus).toBe('success');
  });

  it('loads only open task options and submits the task command', async () => {
    const task = makeTask();
    loadTasks.mockResolvedValue([
      task,
      makeTask({ id: 'task-complete', state: 'completed', status: 'completed', statusLabel: 'Completed' }),
    ]);
    const onAdd = vi.fn().mockResolvedValue(undefined);
    const { result } = renderWorkflow({
      initialSource: 'task',
      canCompleteTask: true,
      onAdd,
    });

    await waitFor(() => expect(result.current.taskOptions).toEqual([task]));
    act(() => {
      result.current.selectTask(task.id);
      result.current.setCompleteTask(true);
      result.current.updateNote('Prepared materials');
    });
    await act(async () => result.current.submit(submitEvent()));

    expect(onAdd).toHaveBeenCalledWith({
      source: 'task',
      staffId: 'staff-1',
      workDate: '2026-08-19',
      taskId: 'task-1',
      completeTask: true,
      hours: 1,
      note: 'Prepared materials',
    });
  });

  it('does not send task completion without task-write capability', async () => {
    const task = makeTask();
    loadTasks.mockResolvedValue([task]);
    const onAdd = vi.fn().mockResolvedValue(undefined);
    const { result } = renderWorkflow({ initialSource: 'task', onAdd });

    await waitFor(() => expect(result.current.taskOptions).toEqual([task]));
    act(() => {
      result.current.selectTask(task.id);
      result.current.setCompleteTask(true);
      result.current.updateNote('Logged without completion permission');
    });
    await act(async () => result.current.submit(submitEvent()));

    expect(onAdd).toHaveBeenCalledWith(expect.objectContaining({
      source: 'task',
      completeTask: false,
    }));
  });

  it('reloads sessions by staff and date before submitting the selected session', async () => {
    vi.mocked(getHoursSessions).mockResolvedValue([{
      id: 'session-1',
      label: 'Leadership',
      programId: 'program-1',
      programName: 'Soft Skills',
      workDate: '2026-08-20',
      startsAt: '2026-08-20T14:00:00.000Z',
    }]);
    const onAdd = vi.fn().mockResolvedValue(undefined);
    const { result } = renderWorkflow({ initialSource: 'session', onAdd });

    await waitFor(() => expect(result.current.sessionOptions).toHaveLength(1));
    act(() => {
      result.current.selectSession('session-1');
      result.current.updateNote('Led session');
    });
    await act(async () => result.current.submit(submitEvent()));

    expect(onAdd).toHaveBeenCalledWith({
      source: 'session',
      staffId: 'staff-1',
      sessionId: 'session-1',
      hours: 1,
      note: 'Led session',
    });
  });

  it('rejects direct form submission when required command data is invalid', async () => {
    const onAdd = vi.fn().mockResolvedValue(undefined);
    const { result } = renderWorkflow({ initialSource: 'task', onAdd });

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

  it('preserves the draft when equal target data is recreated', () => {
    const options: UseHoursModalOptions = {
      isOpen: true,
      resources,
      programs,
      loadTasks,
      onAdd: vi.fn().mockResolvedValue(undefined),
      initialDate: '2026-08-19',
    };
    const { result, rerender } = renderHook(
      (props: UseHoursModalOptions) => useHoursModal(props),
      {
        initialProps: options,
        wrapper: createQueryClientWrapper(createTestQueryClient()),
      },
    );

    act(() => result.current.updateNote('Keep this draft'));
    rerender({
      ...options,
      resources: resources.map(resource => ({ ...resource })),
      programs: programs.map(program => ({ ...program })),
    });

    expect(result.current.draft.note).toBe('Keep this draft');
  });

});
