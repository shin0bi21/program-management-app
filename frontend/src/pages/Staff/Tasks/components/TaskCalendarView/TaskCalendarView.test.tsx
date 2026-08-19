// Scope: verifies buffered task loading, resource filtering, lifecycle actions, range changes, and read-only behavior.
import type { MutableRefObject } from 'react';
import { act, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { buildInitialDayPeriods } from '../../../../../common/components/ResourceCalendar/periods/periods';
import type { ResourceCalendarProps } from '../../../../../common/components/ResourceCalendar/types';
import { getTasks } from '../../../../../common/features/tasks/api/tasks.api';
import type { Task, TaskResource } from '../../../../../common/features/tasks/types';
import { makeTask } from '../../../../../tests/factories/task';
import type { TaskCalendarActions, TaskViewMutationCache } from '../../types';
import TaskCalendarView from './TaskCalendarView';

type CalendarProps = ResourceCalendarProps<TaskResource, Task>;
const calendarState = vi.hoisted(() => ({ props: null as CalendarProps | null }));

vi.mock('../../../../../common/components/ResourceCalendar/ResourceCalendar', () => ({
  default: (props: CalendarProps) => {
    calendarState.props = props;
    return <div aria-label="Task calendar">{props.resources.map(resource => <span key={resource.id}>{resource.name}</span>)}</div>;
  },
}));
vi.mock('../../../../../common/features/tasks/api/tasks.api', () => ({ getTasks: vi.fn() }));

const resource: TaskResource = {
  id: 'staff-1', firstName: 'Zoe', lastName: 'Wilson', name: 'Zoe Wilson', role: 'staff', writable: true,
};
const coworker: TaskResource = {
  id: 'staff-2', firstName: 'Alex', lastName: 'Morgan', name: 'Alex Morgan', role: 'staff', writable: true,
};
const task = makeTask();

function renderCalendar({
  resources = [resource, coworker],
  staffIds = [] as string[],
  canWrite = true,
  selectedTaskId = null as string | null,
} = {}) {
  const mutations: TaskCalendarActions = {
    requestDelete: vi.fn(),
    setStatus: vi.fn().mockResolvedValue(undefined),
    setTaskRange: vi.fn().mockResolvedValue(undefined),
  };
  const mutationCacheRef: MutableRefObject<TaskViewMutationCache> = {
    current: { upsert: vi.fn(), remove: vi.fn() },
  };
  const callbacks = {
    onTaskSelect: vi.fn(), onResourceSelect: vi.fn(), onModalTargetChange: vi.fn(),
  };
  render(<TaskCalendarView
    resources={resources}
    filters={{ staffIds, programIds: [], categories: [], statuses: [] }}
    canWrite={canWrite}
    selectedResourceId="staff-1"
    selectedTaskId={selectedTaskId}
    mutations={mutations}
    mutationCacheRef={mutationCacheRef}
    {...callbacks}
  />);
  return { mutations, mutationCacheRef, ...callbacks };
}

describe('TaskCalendarView', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    calendarState.props = null;
    vi.mocked(getTasks).mockResolvedValue([task]);
  });

  it('loads buffered task data and applies the staff resource filter', async () => {
    renderCalendar({ staffIds: ['staff-1'] });
    const periods = buildInitialDayPeriods(new Date(2026, 7, 10), 3);
    act(() => calendarState.props?.onInitialPeriods?.(periods));

    await waitFor(() => expect(getTasks).toHaveBeenCalledWith({
      start: expect.any(String), end: expect.any(String), includeClosed: true,
    }));
    await waitFor(() => expect(calendarState.props?.rangeData?.['staff-1']).toEqual([task]));
    expect(calendarState.props?.resources).toEqual([resource]);
    expect(calendarState.props?.positionStorageKey).toBe('resource-calendar:tasks:position');
    expect(calendarState.props?.rowHeight).toBe(112);
  });

  it('emits narrow resize and cross-resource move commands with selection changes', async () => {
    const rendered = renderCalendar();
    await act(async () => calendarState.props?.onRangeResize?.({
      resource,
      item: task,
      originalRange: { start: task.startDate, end: task.dueDate },
      nextRange: { start: '2026-08-11', end: '2026-08-13' },
      edge: 'end',
    }));
    await act(async () => calendarState.props?.onRangeMove?.({
      resource,
      destinationResource: coworker,
      item: task,
      originalRange: { start: task.startDate, end: task.dueDate },
      nextRange: { start: '2026-08-12', end: '2026-08-14' },
    }));

    expect(rendered.mutations.setTaskRange).toHaveBeenNthCalledWith(
      1, task, { start: '2026-08-11', end: '2026-08-13' }, 'resize',
    );
    expect(rendered.mutations.setTaskRange).toHaveBeenNthCalledWith(
      2, task, { start: '2026-08-12', end: '2026-08-14' }, 'move', 'staff-2',
    );
    expect(rendered.onResourceSelect).toHaveBeenCalledWith('staff-2');
    expect(rendered.onTaskSelect).toHaveBeenCalledWith(task);
  });

  it('builds lifecycle actions from task state and write capability', async () => {
    const rendered = renderCalendar({ selectedTaskId: 'task-1' });
    const inProgress = { ...task, status: 'in_progress' as const, hoursLogged: 1 };
    const element = calendarState.props?.buildRangeItem?.({
      resource,
      data: inProgress,
      range: { start: inProgress.startDate, end: inProgress.dueDate },
      visibleStart: { key: inProgress.startDate, start: new Date(), end: new Date() },
      visibleEnd: { key: inProgress.dueDate, start: new Date(), end: new Date() },
    }) as { props: { selected: boolean; onComplete: () => void; onCancel: () => void; onEdit: () => void } };

    expect(element.props.selected).toBe(true);
    act(() => element.props.onComplete());
    act(() => element.props.onCancel());
    act(() => element.props.onEdit());
    expect(rendered.mutations.setStatus).toHaveBeenCalledWith(inProgress, 'completed');
    expect(rendered.mutations.setStatus).toHaveBeenCalledWith(inProgress, 'cancelled');
    expect(rendered.onModalTargetChange).toHaveBeenCalledWith(inProgress);
  });

  it('limits date changes and reassignment by task lifecycle', () => {
    renderCalendar();
    const range = { start: task.startDate, end: task.dueDate };
    const inProgress = { ...task, status: 'in_progress' as const, hoursLogged: 1 };
    const completed = { ...task, status: 'completed' as const, hoursLogged: 1 };

    expect(calendarState.props?.getItemCapabilities?.({ resource, data: task, range })).toEqual({
      draggable: true,
      resizable: true,
    });
    expect(calendarState.props?.getItemCapabilities?.({ resource, data: completed, range })).toEqual({
      draggable: false,
      resizable: false,
    });
    expect(calendarState.props?.canRangeMove?.({
      resource,
      destinationResource: resource,
      item: inProgress,
      originalRange: range,
      nextRange: range,
    })).toBe(true);
    expect(calendarState.props?.canRangeMove?.({
      resource,
      destinationResource: coworker,
      item: inProgress,
      originalRange: range,
      nextRange: range,
    })).toBe(false);
    expect(calendarState.props?.canRangeMove?.({
      resource,
      destinationResource: coworker,
      item: task,
      originalRange: range,
      nextRange: range,
    })).toBe(true);
  });

  it('opens a row-scoped add target only for writable resources', () => {
    const rendered = renderCalendar();
    const periods = buildInitialDayPeriods(new Date(2026, 7, 10), 3);
    calendarState.props?.onCellActivate?.({ resource, resourceIndex: 0, period: periods[1], items: [] });
    expect(rendered.onModalTargetChange).toHaveBeenCalledWith({
      startDate: periods[1].key, dueDate: periods[1].key, fixedStaffId: 'staff-1',
    });
  });

  it('removes mutation callbacks in read-only mode and reports range-load errors', async () => {
    vi.mocked(getTasks).mockRejectedValue(new Error('Task request failed'));
    renderCalendar({ canWrite: false });
    const periods = buildInitialDayPeriods(new Date(2026, 7, 10), 3);
    expect(calendarState.props?.onRangeResize).toBeUndefined();
    expect(calendarState.props?.onRangeMove).toBeUndefined();
    expect(calendarState.props?.onCellActivate).toBeUndefined();

    act(() => calendarState.props?.onInitialPeriods?.(periods));
    expect(await screen.findByRole('alert')).toHaveTextContent('Task request failed');
    expect(screen.getByLabelText('Task calendar')).toBeInTheDocument();
  });
});
