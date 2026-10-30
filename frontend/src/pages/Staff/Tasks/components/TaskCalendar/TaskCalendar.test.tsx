import { makeItemCalendarProps } from '../../../../../tests/factories/calendarItem';
import type { MutableRefObject } from 'react';
import { act, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { buildInitialDayPeriods } from '../../../../../common/components/TimelineCalendar/utils/periods';
import type { TimelineCalendarProps } from '../../../../../common/components/TimelineCalendar/types';
import { getTasksCalendarData } from '../../tasks.api';
import type { Task, TaskResource } from '../../types';
import { makeTask } from '../../../../../tests/factories/task';
import type { TaskCalendarCache } from '../../types';
import TaskCalendar, { type TaskCalendarActions } from './TaskCalendar';

type CalendarProps = TimelineCalendarProps<TaskResource, Task>;
const calendarState = vi.hoisted(() => ({ props: null as CalendarProps | null }));

vi.mock('../../../../../common/components/TimelineCalendar/TimelineCalendar', () => ({
  default: (props: CalendarProps) => {
    calendarState.props = props;
    return <div aria-label="Task calendar">{props.rows.map(resource => <span key={resource.id}>{resource.name}</span>)}</div>;
  },
}));
vi.mock('../../tasks.api', () => ({ getTasksCalendarData: vi.fn() }));

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
  onMessageChange = vi.fn(),
} = {}) {
  const actions: TaskCalendarActions = {
    isTaskPending: vi.fn(() => false),
    requestDelete: vi.fn(),
    setState: vi.fn().mockResolvedValue(undefined),
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
  const rendered = render(<TaskCalendar
    resources={resources}
    filters={{ search: '', staffIds, programIds: [], categories: [], statuses: [] }}
    canWrite={canWrite}
    selectedResourceId="staff-1"
    selectedTaskId={selectedTaskId}
    actions={actions}
    calendarCacheRef={calendarCacheRef}
    {...callbacks}
    onMessageChange={onMessageChange}
  />);
  return { ...rendered, actions, calendarCacheRef, onMessageChange, ...callbacks };
}

describe('TaskCalendar', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    calendarState.props = null;
    vi.mocked(getTasksCalendarData).mockResolvedValue([task]);
  });

  it('cancels its range request when unmounted', () => {
    const { unmount } = renderCalendar();
    act(() => calendarState.props?.onInitialPeriods?.(buildInitialDayPeriods(new Date(2026, 7, 10), 1)));
    const signal = vi.mocked(getTasksCalendarData).mock.calls[0][2]?.signal;

    unmount();

    expect(signal?.aborted).toBe(true);
  });

  it('loads buffered task data and applies the staff resource filter', async () => {
    renderCalendar({ staffIds: ['staff-1'] });
    const periods = buildInitialDayPeriods(new Date(2026, 7, 10), 3);
    act(() => calendarState.props?.onInitialPeriods?.(periods));

    await waitFor(() => expect(getTasksCalendarData).toHaveBeenCalledWith(
      { search: '', staffIds: ['staff-1'], programIds: [], categories: [], statuses: [] },
      { start: expect.any(String), end: expect.any(String) },
      { signal: expect.any(AbortSignal) },
    ));
    await waitFor(() => expect(calendarState.props?.items['staff-1']).toEqual([task]));
    expect(calendarState.props?.rows).toEqual([resource]);
  });

  it('emits narrow resize and cross-resource move commands with selection changes', async () => {
    const rendered = renderCalendar();
    await act(async () => calendarState.props?.onItemResize?.({
      row: resource,
      item: task,
      originalRange: { start: task.startDate, end: task.dueDate },
      nextRange: { start: '2026-08-11', end: '2026-08-13' },
      edge: 'end',
    }));
    await act(async () => calendarState.props?.onItemMove?.({
      row: resource,
      destinationRow: coworker,
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

  it('routes item activation through the shared calendar contract', () => {
    const rendered = renderCalendar();

    calendarState.props?.onItemActivate?.({
      row: resource,
      data: task,
      range: { start: task.startDate, end: task.dueDate },
    });

    expect(rendered.onTaskSelect).toHaveBeenCalledWith(task);
  });

  it('keeps the current selection when a range mutation fails', async () => {
    const rendered = renderCalendar();
    vi.mocked(rendered.actions.setTaskRange).mockResolvedValueOnce(null);

    await act(async () => calendarState.props?.onItemMove?.({
      row: resource,
      destinationRow: coworker,
      item: task,
      originalRange: { start: task.startDate, end: task.dueDate },
      nextRange: { start: '2026-08-12', end: '2026-08-14' },
    }));

    expect(rendered.onTaskSelect).not.toHaveBeenCalled();
    expect(rendered.onResourceSelect).not.toHaveBeenCalled();
  });

  it('builds lifecycle actions from task state and write capability', async () => {
    const rendered = renderCalendar({ selectedTaskId: 'task-1' });
    const openTask: Task = { ...task, state: 'open', hoursLogged: 1 };
    const element = calendarState.props?.buildItem({
      row: resource,
      data: openTask,
      range: { start: openTask.startDate, end: openTask.dueDate },
      calendar: makeItemCalendarProps({ row: resource, data: openTask, range: { start: openTask.startDate, end: openTask.dueDate } }),
      visibleStart: { key: openTask.startDate, start: new Date(), end: new Date() },
      visibleEnd: { key: openTask.dueDate, start: new Date(), end: new Date() },
    }) as { props: { selected: boolean; onComplete: () => void; onCancel: () => void; onEdit: () => void } };

    expect(element.props.selected).toBe(true);
    act(() => element.props.onComplete());
    act(() => element.props.onCancel());
    act(() => element.props.onEdit());
    expect(rendered.actions.setState).toHaveBeenCalledWith(openTask, 'completed');
    expect(rendered.actions.setState).toHaveBeenCalledWith(openTask, 'cancelled');
    expect(rendered.onEditTask).toHaveBeenCalledWith(openTask);
  });

  it('limits date changes and reassignment by task lifecycle', () => {
    const rendered = renderCalendar();
    const range = { start: task.startDate, end: task.dueDate };
    const openTaskWithHours = { ...task, state: 'open' as const, hoursLogged: 1 };
    const completed = { ...task, state: 'completed' as const, status: 'completed' as const, hoursLogged: 1 };

    expect(calendarState.props?.getItemCapabilities?.({ row: resource, data: task, range })).toEqual({
      draggable: true,
      resizable: true,
    });
    expect(calendarState.props?.getItemCapabilities?.({ row: resource, data: completed, range })).toEqual({
      draggable: false,
      resizable: false,
    });
    vi.mocked(rendered.actions.isTaskPending).mockReturnValue(true);
    expect(calendarState.props?.getItemCapabilities?.({ row: resource, data: task, range })).toEqual({
      draggable: false,
      resizable: true,
    });
    vi.mocked(rendered.actions.isTaskPending).mockReturnValue(false);
    expect(calendarState.props?.canItemMove?.({
      row: resource,
      destinationRow: resource,
      item: openTaskWithHours,
      originalRange: range,
      nextRange: range,
    })).toBe(true);
    expect(calendarState.props?.canItemMove?.({
      row: resource,
      destinationRow: coworker,
      item: openTaskWithHours,
      originalRange: range,
      nextRange: range,
    })).toBe(false);
    expect(calendarState.props?.canItemMove?.({
      row: resource,
      destinationRow: coworker,
      item: task,
      originalRange: range,
      nextRange: range,
    })).toBe(true);
  });

  it('opens a row-scoped add target only for writable resources', () => {
    const rendered = renderCalendar();
    const periods = buildInitialDayPeriods(new Date(2026, 7, 10), 3);
    calendarState.props?.onCellActivate?.({ row: resource, rowIndex: 0, period: periods[1], items: [] });
    expect(rendered.onAddTask).toHaveBeenCalledWith({
      startDate: periods[1].key, dueDate: periods[1].key, staffId: 'staff-1',
    });
  });

  it('removes mutation callbacks in read-only mode and reports range-load errors', async () => {
    vi.mocked(getTasksCalendarData).mockRejectedValue(new Error('Task request failed'));
    const { onMessageChange } = renderCalendar({ canWrite: false });
    const periods = buildInitialDayPeriods(new Date(2026, 7, 10), 3);
    expect(calendarState.props?.onItemResize).toBeUndefined();
    expect(calendarState.props?.onItemMove).toBeUndefined();
    expect(calendarState.props?.onCellActivate).toBeUndefined();

    act(() => calendarState.props?.onInitialPeriods?.(periods));
    await waitFor(() => expect(onMessageChange).toHaveBeenLastCalledWith(expect.objectContaining({
      message: 'Task request failed',
      action: expect.objectContaining({ label: 'Retry' }),
    })));
    expect(screen.getByText('Task calendar unavailable')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Retry' })).toBeInTheDocument();
  });
});
