import type { DateRange } from '../../../../../common/utils/dateRange';
import { useMemo, type MutableRefObject } from 'react';
import TimelineCalendar from '../../../../../common/components/TimelineCalendar/TimelineCalendar';
import UnavailableState from '../../../../../common/components/UnavailableState/UnavailableState';
import usePageMessageReporter, { type PageMessageChangeHandler } from '../../../../../common/components/PageMessageOverlay/usePageMessageReporter';
import type {
  BuildItemContext,
  CalendarCellContext,
  ItemCapabilityContext,
  ItemMoveContext,
  ItemResizeContext,
  RenderRowContext,
} from '../../../../../common/components/TimelineCalendar/types';
import { formatCompactPersonName } from '../../../../../common/utils/name';
import type { TasksFilters } from '../../tasks.api';
import type { AddTaskContext, Task, TaskCalendarCache, StaffReference } from '../../types';
import {
  canCancelTask,
  canCompleteTask,
  canDeleteTask,
  canEditTask,
  canReopenTask,
} from '../../utils/taskCapabilities';
import TaskItem from './TaskItem/TaskItem';
import useTaskCalendarData from './hooks/useTaskCalendarData';

const TASK_CALENDAR_POSITION_KEY = 'resource-calendar:tasks:position';

export interface TaskCalendarActions {
  isTaskPending: (taskId: string) => boolean;
  requestDelete: (task: Task) => void;
  setState: (task: Task, state: Task['state']) => Promise<void>;
  setTaskRange: (
    task: Task,
    nextRange: { start: string; end: string },
    action: 'move' | 'resize',
    staffId?: string,
  ) => Promise<Task | null>;
}

interface TaskCalendarProps {
  staff: StaffReference[];
  filters: TasksFilters;
  dateRange?: DateRange;
  canWrite: boolean;
  selectedStaffId: string | null;
  selectedTaskId: string | null;
  actions: TaskCalendarActions;
  calendarCacheRef: MutableRefObject<TaskCalendarCache>;

  onTaskSelect: (task: Task) => void;
  onStaffSelect: (staffId: string) => void;
  onAddTask: (context: AddTaskContext) => void;
  onEditTask: (task: Task) => void;
  onMessageChange?: PageMessageChangeHandler;
}

/**
 * Displays buffered task records and inclusive date placement.
 * @example <TaskCalendar filters={filters} {...viewProps} />
 */
export default function TaskCalendar({
  staff,
  filters,
  dateRange,
  canWrite,
  selectedStaffId,
  selectedTaskId,
  actions,
  calendarCacheRef,

  onTaskSelect,
  onStaffSelect,
  onAddTask,
  onEditTask,
  onMessageChange,
}: TaskCalendarProps) {
  const { staffIds } = filters;
  const { calendar, visibleItems } = useTaskCalendarData(filters, calendarCacheRef);

  const retryAction = useMemo(() => ({ label: 'Retry', onClick: calendar.retry }), [calendar.retry]);
  usePageMessageReporter(onMessageChange, calendar.error, retryAction);

  const visibleStaff = useMemo(() => {
    if (!staffIds.length) return staff;

    return staff.filter(staffMember => staffIds.includes(staffMember.id));
  }, [staffIds, staff]);

  /**
   * Displays a buffered task with actions allowed by its lifecycle and permissions.
   * @example buildItem(context) // task item with permitted actions
   */
  function buildItem({ data: task, calendar: itemCalendar }: BuildItemContext<StaffReference, Task>) {
    const actionsAvailable = canWrite && task.writable && !actions.isTaskPending(task.id);

    return (
      <TaskItem
        calendar={itemCalendar}
        task={task}
        selected={task.id === selectedTaskId}
        onComplete={actionsAvailable && canCompleteTask(task) ? () => void actions.setState(task, 'completed') : undefined}
        onCancel={actionsAvailable && canCancelTask(task) ? () => void actions.setState(task, 'cancelled') : undefined}
        onReopen={actionsAvailable && canReopenTask(task) ? () => void actions.setState(task, 'open') : undefined}
        onEdit={actionsAvailable && canEditTask(task) ? () => onEditTask(task) : undefined}
        onDelete={actionsAvailable && canDeleteTask(task) ? () => actions.requestDelete(task) : undefined}
      />
    );
  }

  /**
   * Enables date interactions according to task permissions and pending placement.
   * @example getItemCapabilities(context) // draggable and resizable flags
   */
  function getItemCapabilities({ data: task }: ItemCapabilityContext<StaffReference, Task>) {
    const canAdjustDates = canWrite && task.writable && canEditTask(task);
    const taskPending = actions.isTaskPending(task.id);

    return { draggable: canAdjustDates && !taskPending, resizable: canAdjustDates };
  }

  /**
   * Checks destination write access and task reassignment eligibility.
   * @example canMoveTask(context) // false for reassignment after hours are logged
   */
  function canMoveTask({ item: task, row, destinationRow }: ItemMoveContext<StaffReference, Task>) {
    const canWriteDestination = task.writable && !actions.isTaskPending(task.id) && destinationRow.writable;
    const canUseDestination = row.id === destinationRow.id || canReassignTask(task);

    return canWriteDestination && canUseDestination;
  }

  /**
   * Saves the requested task dates and assignee, then selects a successful result.
   * @example moveTask(context) // reports a move to the page action owner
   */
  async function moveTask({ item: task, nextRange, destinationRow }: ItemMoveContext<StaffReference, Task>) {
    const updatedTask = await actions.setTaskRange(task, nextRange, 'move', destinationRow.id);

    if (updatedTask) onTaskSelect(updatedTask);
  }

  /**
   * Saves a changed task range and selects the successful result.
   * @example resizeTask(context) // reports a resize to the page action owner
   */
  async function resizeTask({ item: task, nextRange }: ItemResizeContext<StaffReference, Task>) {
    const updatedTask = await actions.setTaskRange(task, nextRange, 'resize');

    if (updatedTask) onTaskSelect(updatedTask);
  }

  /**
   * Opens task creation for a writable staff row and selected day.
   * @example addTask(context) // adds a task scoped to this staff member
   */
  function addTask({ row, period }: CalendarCellContext<StaffReference, Task>) {
    if (!row.writable) return;

    onAddTask({ startDate: period.key, dueDate: period.key, staffId: row.id });
  }

  if (calendar.error) {
    return <UnavailableState title="Task calendar unavailable" onRetry={calendar.retry} />;
  }

  return (
    <TimelineCalendar
      ariaLabel="Task calendar"
      dateRange={dateRange}
      positionStorageKey={TASK_CALENDAR_POSITION_KEY}
      onPeriodsBuilt={calendar.onPeriodsBuilt}
      onInitialPeriods={calendar.initialize}
      onPeriodsReset={calendar.reset}

      rows={visibleStaff}
      rowHeader="Staff"
      getRowId={getStaffId}
      renderRow={renderStaffRow}
      selectedRowId={selectedStaffId}
      onRowSelect={row => onStaffSelect(row.id)}

      items={visibleItems}
      getItemId={getTaskId}
      getItemRange={getTaskRange}
      buildItem={buildItem}

      getItemCapabilities={getItemCapabilities}
      onItemActivate={({ data: task }) => onTaskSelect(task)}
      onItemMove={canWrite ? moveTask : undefined}
      canItemMove={canMoveTask}
      onItemResize={canWrite ? resizeTask : undefined}

      onCellActivate={canWrite ? addTask : undefined}
    />
  );
}

/** Identifies a staff row. @example getStaffId(staffMember) // staffMember.id */
function getStaffId(staffMember: StaffReference) {
  return staffMember.id;
}
/**
 * Displays a compact staff name in the staff member header.
 * @example renderStaffRow(context) // staff display name
 */
function renderStaffRow({ row }: RenderRowContext<StaffReference>) {
  return <span aria-label={row.name}>{formatCompactPersonName(row.firstName, row.lastName)}</span>;
}


/** Identifies a task. @example getTaskId(task) // task.id */
function getTaskId(task: { id: string }) {
  return task.id;
}
/** Reads inclusive assignment dates. @example getTaskRange(task) // { start: task.startDate, end: task.dueDate } */
function getTaskRange(task: Task) {
  return { start: task.startDate, end: task.dueDate };
}


/**
 * Allows reassignment only for open tasks without logged hours.
 * @example canReassignTask(task) // false after time has been logged
 */
function canReassignTask(task: Task) {
  return task.state === 'open' && task.hoursLogged === 0;
}
