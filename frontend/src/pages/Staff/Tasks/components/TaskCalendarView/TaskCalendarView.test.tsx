// Scope: verifies buffered task loading, resource filtering, lifecycle actions, range changes, and read-only behavior.
import type { MutableRefObject } from 'react';
import { act, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { buildInitialDayPeriods } from '../../../../../common/components/ResourceCalendar/periods/periods';
import type { ResourceCalendarProps } from '../../../../../common/components/ResourceCalendar/types';
import { getTasks } from '../../../../../common/features/tasks/tasks.api';
import type { Task, TaskResource } from '../../../../../common/features/tasks/types';
import { makeTask } from '../../../../../tests/factories/task';
import type { TaskCalendarActions, TaskCalendarCache } from '../../types';
import TaskCalendarView from './TaskCalendarView';

type CalendarProps = ResourceCalendarProps<TaskResource, Task>;
const calendarState = vi.hoisted(() => ({ props: null as CalendarProps | null }));

vi.mock('../../../../../common/components/ResourceCalendar/ResourceCalendar', () => ({
  default: (props: CalendarProps) => {
    calendarState.props = props;
    return <div aria-label="Task calendar">{props.resources.map(resource => <span key={resource.id}>{resource.name}</span>)}</div>;
  },
}));
vi.mock('../../../../../common/features/tasks/tasks.api', () => ({ getTasks: vi.fn() }));

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
  const actions: TaskCalendarActions = {
    isTaskPending: vi.fn(() => false),
    requestDelete: vi.fn(),
    setStatus: vi.fn().mockResolvedValue(undefined),
    setTaskRange: vi.fn().mockImplementation(async (
      currentTask,
      nextRange,
      _action,
      staffId = currentTask.assignee.id,
    ) => ({
      ...currentTask,
      startDate: nextRange.start,
      dueDate: nextRange.end,
      assignee: staffId === coworker.id
        ? { id: coworker.id, firstName: coworker.firstName, lastName: coworker.lastName, name: coworker.name }
        : currentTask.assignee,
    })),
  };
  const calendarCacheRef: MutableRefObject<TaskCalendarCache> = {
    current: { upsert: vi.fn(), remove: vi.fn() },
  };
  const callbacks = {
    onTaskSelect: vi.fn(), onResourceSelect: vi.fn(), onAddTask: vi.fn(), onEditTask: vi.fn(),
  };
  render(<TaskCalendarView
    resources={resources}
    filters={{ staffIds, programIds: [], categories: [], statuses: [] }}
    canWrite={canWrite}
    selectedResourceId="staff-1"
    selectedTaskId={selectedTaskId}
    today="2026-08-11"
    actions={actions}
    calendarCacheRef={calendarCacheRef}
    {...callbacks}
  />);
  return { actions, calendarCacheRef, ...callbacks };
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

    expect(rendered.actions.setTaskRange).toHaveBeenNthCalledWith(
      1, task, { start: '2026-08-11', end: '2026-08-13' }, 'resize',
    );
    expect(rendered.actions.setTaskRange).toHaveBeenNthCalledWith(
      2, task, { start: '2026-08-12', end: '2026-08-14' }, 'move', 'staff-2',
    );
    expect(rendered.onTaskSelect).toHaveBeenNthCalledWith(1, expect.objectContaining({
      startDate: '2026-08-11', dueDate: '2026-08-13',
    }));
    expect(rendered.onTaskSelect).toHaveBeenNthCalledWith(2, expect.objectContaining({
      startDate: '2026-08-12', dueDate: '2026-08-14',
      assignee: expect.objectContaining({ id: 'staff-2' }),
    }));
    expect(rendered.onResourceSelect).not.toHaveBeenCalled();
  });

  it('keeps the current selection when a range mutation fails', async () => {
    const rendered = renderCalendar();
    vi.mocked(rendered.actions.setTaskRange).mockResolvedValueOnce(null);

    await act(async () => calendarState.props?.onRangeMove?.({
      resource,
      destinationResource: coworker,
      item: task,
      originalRange: { start: task.startDate, end: task.dueDate },
      nextRange: { start: '2026-08-12', end: '2026-08-14' },
    }));

    expect(rendered.onTaskSelect).not.toHaveBeenCalled();
    expect(rendered.onResourceSelect).not.toHaveBeenCalled();
  });

  it('builds lifecycle actions from task state and write capability', async () => {
    const rendered = renderCalendar({ selectedTaskId: 'task-1' });
    const openTask = { ...task, status: 'open' as const, hoursLogged: 1 };
    const element = calendarState.props?.buildRangeItem?.({
      resource,
      data: openTask,
      range: { start: openTask.startDate, end: openTask.dueDate },
      visibleStart: { key: openTask.startDate, start: new Date(), end: new Date() },
      visibleEnd: { key: openTask.dueDate, start: new Date(), end: new Date() },
    }) as { props: { selected: boolean; onComplete: () => void; onCancel: () => void; onEdit: () => void } };

    expect(element.props.selected).toBe(true);
    act(() => element.props.onComplete());
    act(() => element.props.onCancel());
    act(() => element.props.onEdit());
    expect(rendered.actions.setStatus).toHaveBeenCalledWith(openTask, 'completed');
    expect(rendered.actions.setStatus).toHaveBeenCalledWith(openTask, 'cancelled');
    expect(rendered.onEditTask).toHaveBeenCalledWith(openTask);
  });

  it('limits date changes and reassignment by task lifecycle', () => {
    renderCalendar();
    const range = { start: task.startDate, end: task.dueDate };
    const openTaskWithHours = { ...task, status: 'open' as const, hoursLogged: 1 };
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
      item: openTaskWithHours,
      originalRange: range,
      nextRange: range,
    })).toBe(true);
    expect(calendarState.props?.canRangeMove?.({
      resource,
      destinationResource: coworker,
      item: openTaskWithHours,
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
    expect(rendered.onAddTask).toHaveBeenCalledWith({
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
