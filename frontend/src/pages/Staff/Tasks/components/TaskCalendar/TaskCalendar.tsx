import { taskStore } from '../../taskStore';
import { useQueryClient } from '@tanstack/react-query';
import type { DateRange } from '../../../../../common/utils/dateRange';
import { useCallback, useEffect, useMemo, type MutableRefObject } from 'react';
import TimelineCalendar from '../../../../../common/components/TimelineCalendar/TimelineCalendar';
import UnavailableState from '../../../../../common/components/UnavailableState/UnavailableState';
import usePageMessageReporter, { type PageMessageChangeHandler } from '../../../../../common/components/PageMessageOverlay/usePageMessageReporter';
import { useDataBuffer } from '../../../../../common/components/TimelineCalendar/hooks/useDataBuffer/useDataBuffer';
import type { PeriodRange } from '../../../../../common/components/TimelineCalendar/hooks/useDataBuffer/DataBuffer';
import type {
  BuildItemContext,
  CalendarItemReference,
  RowItemData,
  CalendarCellContext,
  ItemCapabilityContext,
  ItemMoveContext,
  ItemResizeContext,
  RenderRowContext,
} from '../../../../../common/components/TimelineCalendar/types';
import { formatCompactPersonName } from '../../../../../common/utils/name';
import { getTasksCalendarData, type TasksFilters } from '../../tasks.api';
import type { AddTaskModalInitialValues, Task, TaskCalendarCache, TaskResource } from '../../types';
import {
  canCancelTask,
  canCompleteTask,
  canDeleteTask,
  canEditTask,
  canReopenTask,
} from '../../utils/taskCapabilities';
import TaskItem from './TaskItem/TaskItem';

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
  resources: TaskResource[];
  filters: TasksFilters;
  dateRange?: DateRange;
  canWrite: boolean;
  selectedResourceId: string | null;
  selectedTaskId: string | null;
  actions: TaskCalendarActions;
  calendarCacheRef: MutableRefObject<TaskCalendarCache>;

  onTaskSelect: (task: Task) => void;
  onResourceSelect: (resourceId: string) => void;
  onAddTask: (initialValues: AddTaskModalInitialValues) => void;
  onEditTask: (task: Task) => void;
  onMessageChange?: PageMessageChangeHandler;
}

const getTaskResourceId = (resource: TaskResource) => resource.id;
const getTaskId = (task: { id: string }) => task.id;
const getReferenceRange = (reference: CalendarItemReference) => ({ start: reference.start, end: reference.end });
const getTaskRange = (task: Task) => ({ start: task.startDate, end: task.dueDate });

/**
 * Displays a compact staff name in the resource header.
 * @example renderStaffRow(context) // staff display name
 */
function renderStaffRow({ row }: RenderRowContext<TaskResource>) {
  return <span aria-label={row.name}>{formatCompactPersonName(row.firstName, row.lastName)}</span>;
}

/**
 * Allows reassignment only for open tasks without logged hours.
 * @example canReassignTask(task) // false after time has been logged
 */
function canReassignTask(task: Task) {
  return task.state === 'open' && task.hoursLogged === 0;
}

/**
 * Displays shared task records using buffered IDs and inclusive date placement.
 * @example <TaskCalendar filters={filters} {...viewProps} />
 */
export default function TaskCalendar({
  resources,
  filters,
  dateRange,
  canWrite,
  selectedResourceId,
  selectedTaskId,
  actions,
  calendarCacheRef,

  onTaskSelect,
  onResourceSelect,
  onAddTask,
  onEditTask,
  onMessageChange,
}: TaskCalendarProps) {
  const { staffIds } = filters;
  const client = useQueryClient();
  const records = taskStore.useRecords();

  const loadRange = useCallback(async ({ start, end }: PeriodRange, signal: AbortSignal) => {
    const read = taskStore.beginRead(client);
    const incoming = await getTasksCalendarData(filters, { start: start.key, end: end.key }, { signal });
    const tasks = taskStore.finishRead(client, read, incoming, signal);
    const data: Record<string, Record<string, CalendarItemReference[]>> = {};

    for (const task of tasks) {
      const resourceId = task.assignee.id;
      data[resourceId] ??= {};
      data[resourceId][start.key] ??= [];
      data[resourceId][start.key].push({ id: task.id, ...getTaskRange(task) });
    }

    return data;
  }, [client, filters]);

  const calendar = useDataBuffer({
    load: loadRange,
    getItemId: getTaskId,
    getItemRange: getReferenceRange,
    errorMessage: 'Unable to load task calendar data',
  });
  const visibleItems = useMemo<RowItemData<Task>>(() => {
    const items: Record<string, Task[]> = {};
    for (const references of Object.values(calendar.items)) {
      for (const { id } of references ?? []) {
        const task = records[id];
        if (task) (items[task.assignee.id] ??= []).push(task);
      }
    }
    return items;
  }, [calendar.items, records]);
  const { upsertItem, removeItem } = calendar;

  const retryAction = useMemo(() => ({ label: 'Retry', onClick: calendar.retry }), [calendar.retry]);
  usePageMessageReporter(onMessageChange, calendar.error, retryAction);

  useEffect(() => {
    calendarCacheRef.current = {
      upsert: task => upsertItem(task.assignee.id, task.startDate, { id: task.id, ...getTaskRange(task) }),
      remove: removeItem,
    };

    return () => {
      calendarCacheRef.current = {
        upsert: () => undefined,
        remove: () => undefined,
      };
    };
  }, [calendarCacheRef, removeItem, upsertItem]);

  const visibleResources = useMemo(() => {
    if (!staffIds.length) return resources;

    return resources.filter(resource => staffIds.includes(resource.id));
  }, [staffIds, resources]);

  /**
   * Displays a shared task with actions allowed by its lifecycle and permissions.
   * @example buildItem(context) // task item with permitted actions
   */
  function buildItem({ data: task, calendar: itemCalendar }: BuildItemContext<TaskResource, Task>) {
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
  function getItemCapabilities({ data: task }: ItemCapabilityContext<TaskResource, Task>) {
    const canAdjustDates = canWrite && task.writable && canEditTask(task);
    const taskPending = actions.isTaskPending(task.id);

    return { draggable: canAdjustDates && !taskPending, resizable: canAdjustDates };
  }

  /**
   * Checks destination write access and task reassignment eligibility.
   * @example canMoveTask(context) // false for reassignment after hours are logged
   */
  function canMoveTask({ item: task, row, destinationRow }: ItemMoveContext<TaskResource, Task>) {
    const canWriteDestination = task.writable && !actions.isTaskPending(task.id) && destinationRow.writable;
    const canUseDestination = row.id === destinationRow.id || canReassignTask(task);

    return canWriteDestination && canUseDestination;
  }

  /**
   * Saves the requested task dates and assignee, then selects a successful result.
   * @example moveTask(context) // reports a move to the page action owner
   */
  async function moveTask({ item: task, nextRange, destinationRow }: ItemMoveContext<TaskResource, Task>) {
    const updatedTask = await actions.setTaskRange(task, nextRange, 'move', destinationRow.id);

    if (updatedTask) onTaskSelect(updatedTask);
  }

  /**
   * Saves a changed task range and selects the successful result.
   * @example resizeTask(context) // reports a resize to the page action owner
   */
  async function resizeTask({ item: task, nextRange }: ItemResizeContext<TaskResource, Task>) {
    const updatedTask = await actions.setTaskRange(task, nextRange, 'resize');

    if (updatedTask) onTaskSelect(updatedTask);
  }

  /**
   * Opens task creation for a writable staff row and selected day.
   * @example addTask(context) // adds a task scoped to this staff member
   */
  function addTask({ row, period }: CalendarCellContext<TaskResource, Task>) {
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

      rows={visibleResources}
      rowHeader="Staff"
      getRowId={getTaskResourceId}
      renderRow={renderStaffRow}
      selectedRowId={selectedResourceId}
      onRowSelect={row => onResourceSelect(row.id)}

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
