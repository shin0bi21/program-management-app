import { renderWithQueryClient as render } from '../../../../../tests/queryClientTestUtils';
import { makeItemCalendarProps } from '../../../../../tests/factories/calendarItem';
import type { ComponentProps, MutableRefObject, ReactElement } from 'react';
import { act, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { buildInitialDayPeriods } from '../../../../../common/components/TimelineCalendar/utils/periods';
import type { TimelineCalendarProps } from '../../../../../common/components/TimelineCalendar/types';
import { getTasksCalendarData } from './api/taskCalendar.api';
import type { Task, StaffReference } from '../../types';
import { makeTask } from '../../../../../tests/factories/task';
import type { TaskCalendarCache } from '../../types';
import TaskCalendar, { type TaskCalendarActions } from './TaskCalendar';
import type TaskItem from './TaskItem/TaskItem';

type CalendarProps = TimelineCalendarProps<StaffReference, Task>;
type RenderCalendarOptions = Partial<Pick<ComponentProps<typeof TaskCalendar>,
  'staff' | 'canWrite' | 'selectedTaskId'
>> & { staffIds?: string[] };

const calendarState = vi.hoisted(() => ({ props: null as CalendarProps | null }));

vi.mock('../../../../../common/components/TimelineCalendar/TimelineCalendar', () => ({
  default: (props: CalendarProps) => {
    calendarState.props = props;
    return <div aria-label="Task calendar">{props.rows.map(staffMember => <span key={staffMember.id}>{staffMember.name}</span>)}</div>;
  },
}));
vi.mock('./api/taskCalendar.api', () => ({ getTasksCalendarData: vi.fn() }));

const staffMember: StaffReference = {
  id: 'staff-1', firstName: 'Zoe', lastName: 'Wilson', name: 'Zoe Wilson', role: 'staff', writable: true,
};
const coworker: StaffReference = {
  id: 'staff-2', firstName: 'Alex', lastName: 'Morgan', name: 'Alex Morgan', role: 'staff', writable: true,
};
const task = makeTask();

describe('TaskCalendar', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    calendarState.props = null;
    vi.mocked(getTasksCalendarData).mockResolvedValue([task]);
  });

  it('loads buffered task data and applies the staff member filter', async () => {
    renderCalendar({ staffIds: ['staff-1'] });
    const periods = buildInitialDayPeriods('2026-08-10', 3);
    act(() => calendarState.props?.onInitialPeriods?.(periods));

    await waitFor(() => expect(getTasksCalendarData).toHaveBeenCalledWith(
      { cycleIds: [], search: '', staffIds: ['staff-1'], programIds: [], categories: [], statuses: [] },
      { start: expect.any(String), end: expect.any(String) },
      { signal: expect.any(AbortSignal) },
    ));
    await waitFor(() => expect(calendarState.props?.items['staff-1']).toEqual([task]));
    expect(calendarState.props?.rows).toEqual([staffMember]);
  });

  it('updates full buffered rows through mutation callbacks after saves and deletes', async () => {
    const { calendarCacheRef } = renderCalendar();
    act(() => calendarState.props!.onInitialPeriods!(buildInitialDayPeriods('2026-08-10', 3)));
    await waitFor(() => expect(calendarState.props!.items['staff-1']).toEqual([task]));

    const saved = makeTask({ title: 'Saved by another consumer' });
    act(() => calendarCacheRef.current.upsert(saved));
    await waitFor(() => expect(calendarState.props!.items['staff-1']?.[0].title).toBe(saved.title));

    act(() => calendarCacheRef.current.remove(task.id));
    await waitFor(() => expect(calendarState.props!.items['staff-1'] ?? []).toEqual([]));
  });

  it('emits narrow resize and cross-staff member move commands with selection changes', async () => {
    const rendered = renderCalendar();
    const resizedTask = makeTask({ startDate: '2026-08-11', dueDate: '2026-08-13' });
    const movedTask = makeTask({
      startDate: '2026-08-12', dueDate: '2026-08-14', staffId: coworker.id,
      firstName: coworker.firstName, lastName: coworker.lastName,
    });
    vi.mocked(rendered.actions.setTaskRange)
      .mockResolvedValueOnce(resizedTask)
      .mockResolvedValueOnce(movedTask);

    await act(async () => calendarState.props?.onItemResize?.({
      row: staffMember,
      item: task,
      originalRange: { start: task.startDate, end: task.dueDate },
      nextRange: { start: '2026-08-11', end: '2026-08-13' },
      edge: 'end',
    }));
    await act(async () => calendarState.props?.onItemMove?.({
      row: staffMember,
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
    expect(rendered.onTaskSelect).toHaveBeenNthCalledWith(1, resizedTask);
    expect(rendered.onTaskSelect).toHaveBeenNthCalledWith(2, movedTask);
    expect(rendered.onStaffSelect).not.toHaveBeenCalled();
  });

  it('routes item activation through the shared calendar contract', () => {
    const rendered = renderCalendar();

    calendarState.props?.onItemActivate?.({
      row: staffMember,
      data: task,
      range: { start: task.startDate, end: task.dueDate },
    });

    expect(rendered.onTaskSelect).toHaveBeenCalledWith(task);
  });

  it('marks only the task matching the selected ID as selected', () => {
    const tasks = [task, makeTask({ id: 'task-2' })];
    renderCalendar({ selectedTaskId: task.id });

    const selectedFlags = tasks.map(data => {
      const range = { start: data.startDate, end: data.dueDate };
      const element = calendarState.props!.buildItem({
        row: staffMember,
        data,
        range,
        calendar: makeItemCalendarProps({ row: staffMember, data, range }),
        visibleStart: { key: data.startDate, start: data.startDate, end: data.startDate },
        visibleEnd: { key: data.dueDate, start: data.dueDate, end: data.dueDate },
      }) as ReactElement<ComponentProps<typeof TaskItem>>;

      return element.props.selected;
    });

    expect(selectedFlags).toEqual([true, false]);
  });

  it('keeps the current selection when a range mutation fails', async () => {
    const rendered = renderCalendar();
    vi.mocked(rendered.actions.setTaskRange).mockResolvedValueOnce(null);

    await act(async () => calendarState.props?.onItemMove?.({
      row: staffMember,
      destinationRow: coworker,
      item: task,
      originalRange: { start: task.startDate, end: task.dueDate },
      nextRange: { start: '2026-08-12', end: '2026-08-14' },
    }));

    expect(rendered.onTaskSelect).not.toHaveBeenCalled();
    expect(rendered.onStaffSelect).not.toHaveBeenCalled();
  });

  it('builds lifecycle actions from task state and write capability', async () => {
    const rendered = renderCalendar();
    const openTask: Task = { ...task, state: 'open', hoursLogged: 1 };
    const element = calendarState.props?.buildItem({
      row: staffMember,
      data: openTask,
      range: { start: openTask.startDate, end: openTask.dueDate },
      calendar: makeItemCalendarProps({ row: staffMember, data: openTask, range: { start: openTask.startDate, end: openTask.dueDate } }),
      visibleStart: { key: openTask.startDate, start: openTask.startDate, end: openTask.dueDate },
      visibleEnd: { key: openTask.dueDate, start: openTask.startDate, end: openTask.dueDate },
    }) as ReactElement<ComponentProps<typeof TaskItem>>;

    act(() => element.props.onComplete!());
    act(() => element.props.onCancel!());
    act(() => element.props.onEdit!());
    expect(rendered.actions.setState).toHaveBeenCalledWith(openTask, 'completed');
    expect(rendered.actions.setState).toHaveBeenCalledWith(openTask, 'cancelled');
    expect(rendered.onEditTask).toHaveBeenCalledWith(openTask);
  });

  it('limits date changes and reassignment by task lifecycle', () => {
    const rendered = renderCalendar();
    const range = { start: task.startDate, end: task.dueDate };
    const openTaskWithHours = { ...task, state: 'open' as const, hoursLogged: 1 };
    const completed = { ...task, state: 'completed' as const, status: 'completed' as const, hoursLogged: 1 };

    expect(calendarState.props?.getItemCapabilities?.({ row: staffMember, data: task, range })).toEqual({
      draggable: true,
      resizable: true,
    });
    expect(calendarState.props?.getItemCapabilities?.({ row: staffMember, data: completed, range })).toEqual({
      draggable: false,
      resizable: false,
    });
    vi.mocked(rendered.actions.isTaskPending).mockReturnValue(true);
    expect(calendarState.props?.getItemCapabilities?.({ row: staffMember, data: task, range })).toEqual({
      draggable: false,
      resizable: true,
    });
    vi.mocked(rendered.actions.isTaskPending).mockReturnValue(false);
    expect(calendarState.props?.canItemMove?.({
      row: staffMember,
      destinationRow: staffMember,
      item: openTaskWithHours,
      originalRange: range,
      nextRange: range,
    })).toBe(true);
    expect(calendarState.props?.canItemMove?.({
      row: staffMember,
      destinationRow: coworker,
      item: openTaskWithHours,
      originalRange: range,
      nextRange: range,
    })).toBe(false);
    expect(calendarState.props?.canItemMove?.({
      row: staffMember,
      destinationRow: coworker,
      item: task,
      originalRange: range,
      nextRange: range,
    })).toBe(true);
  });

  it('opens a row-scoped add target for writable staff', () => {
    const rendered = renderCalendar();
    const periods = buildInitialDayPeriods('2026-08-10', 3);
    calendarState.props?.onCellActivate?.({ row: staffMember, rowIndex: 0, period: periods[1], items: [] });
    expect(rendered.onAddTask).toHaveBeenCalledWith({
      startDate: periods[1].key, dueDate: periods[1].key, staffId: 'staff-1',
    });
  });

  it('removes mutation callbacks in read-only mode and keeps failed ranges distinct from empty results', async () => {
    vi.mocked(getTasksCalendarData).mockRejectedValue(new Error('Task request failed'));
    renderCalendar({ canWrite: false });
    const periods = buildInitialDayPeriods('2026-08-10', 3);
    expect(calendarState.props?.onItemResize).toBeUndefined();
    expect(calendarState.props?.onItemMove).toBeUndefined();
    expect(calendarState.props?.onCellActivate).toBeUndefined();

    act(() => calendarState.props?.onInitialPeriods?.(periods));
    expect(await screen.findByText('Task calendar unavailable')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Retry' })).toBeInTheDocument();
  });
});

/** Renders a calendar with permitted action stubs. @example renderCalendar({ canWrite: false }) */
function renderCalendar({
  staff = [staffMember, coworker],
  staffIds = [],
  canWrite = true,
  selectedTaskId = null,
}: RenderCalendarOptions = {}) {
  const actions: TaskCalendarActions = {
    isTaskPending: vi.fn(() => false),
    requestDelete: vi.fn(),
    setState: vi.fn().mockResolvedValue(undefined),
    setTaskRange: vi.fn().mockResolvedValue(null),
  };
  const calendarCacheRef: MutableRefObject<TaskCalendarCache> = {
    current: { upsert: vi.fn(), remove: vi.fn() },
  };
  const callbacks = {
    onTaskSelect: vi.fn(), onStaffSelect: vi.fn(), onAddTask: vi.fn(), onEditTask: vi.fn(),
  };
  const rendered = render(<TaskCalendar
    staff={staff}
    filters={{ cycleIds: [], search: '', staffIds, programIds: [], categories: [], statuses: [] }}
    canWrite={canWrite}
    selectedStaffId="staff-1"
    selectedTaskId={selectedTaskId}
    actions={actions}
    calendarCacheRef={calendarCacheRef}
    {...callbacks}
  />);
  return { ...rendered, actions, calendarCacheRef, ...callbacks };
}
