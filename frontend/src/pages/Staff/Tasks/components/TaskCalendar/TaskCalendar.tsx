import { useCallback, useEffect, useMemo } from 'react';
import TimelineCalendar from '../../../../../common/components/TimelineCalendar/TimelineCalendar';
import usePageErrorReporter, { type PageErrorChangeHandler } from '../../../../../common/components/PageErrorOverlay/usePageErrorReporter';
import { useDataBuffer } from '../../../../../common/components/TimelineCalendar/hooks/useDataBuffer/useDataBuffer';
import type { PeriodRange } from '../../../../../common/components/TimelineCalendar/hooks/useDataBuffer/DataBuffer';
import { getTasksCalendarData } from '../../tasks.api';
import type { Task, TaskResource, TasksFilters } from '../../types';
import { formatCompactPersonName } from '../../../../../common/utils/name';
import type { AddTaskModalInitialValues, TaskCalendarCache } from '../../types';
import {
  canCancelTask, canCompleteTask, canDeleteTask, canEditTask, canReopenTask,
} from '../../utils/taskCapabilities';
import TaskItem from './TaskItem/TaskItem';
import UnavailableState from '../../../../../common/components/UnavailableState/UnavailableState';

const TASK_CALENDAR_POSITION_KEY = 'resource-calendar:tasks:position';
const getTaskId = (task: Task) => task.id;
const getTaskRange = (task: Task) => ({ start: task.startDate, end: task.dueDate });

function getTaskCalendarCapabilities(task: Task, canWriteTask: boolean, taskPending: boolean) {
  const canAdjustDates = canWriteTask && canEditTask(task);
  return { draggable: canAdjustDates && !taskPending, resizable: canAdjustDates };
}

function canReassignTask(task: Task) {
  return task.state === 'open' && task.hoursLogged === 0;
}

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
  canWrite: boolean;
  selectedResourceId: string | null;
  selectedTaskId: string | null;
  actions: TaskCalendarActions;
  calendarCacheRef: React.MutableRefObject<TaskCalendarCache>;
  onTaskSelect: (task: Task) => void;
  onResourceSelect: (resourceId: string) => void;
  onAddTask: (initialValues: AddTaskModalInitialValues) => void;
  onEditTask: (task: Task) => void;
  onErrorChange?: PageErrorChangeHandler;
}

export default function TaskCalendar({
  resources, filters, canWrite, selectedResourceId, selectedTaskId, actions, calendarCacheRef,
  onTaskSelect, onResourceSelect, onAddTask, onEditTask, onErrorChange,
}: TaskCalendarProps) {
  const loadRange = useCallback(async ({ start, end }: PeriodRange) => {
    const tasks = await getTasksCalendarData(filters, { start: start.key, end: end.key });
    return tasks.reduce<Record<string, Record<string, Task[]>>>((data, task) => {
      data[task.assignee.id] ??= {};
      data[task.assignee.id][start.key] ??= [];
      data[task.assignee.id][start.key].push(task);
      return data;
    }, {});
  }, [filters]);
  const calendar = useDataBuffer({
    load: loadRange,
    getItemId: getTaskId,
    getItemRange: getTaskRange,
    errorMessage: 'Unable to load task calendar data',
  });
  const { upsertItem, removeItem } = calendar;
  const retryAction = useMemo(() => ({ label: 'Retry', onClick: calendar.retry }), [calendar.retry]);
  usePageErrorReporter(onErrorChange, calendar.error, retryAction);
  useEffect(() => {
    calendarCacheRef.current = {
      upsert: task => upsertItem(task.assignee.id, task.startDate, task),
      remove: removeItem,
    };
    return () => { calendarCacheRef.current = { upsert: () => undefined, remove: () => undefined }; };
  }, [calendarCacheRef, removeItem, upsertItem]);
  const visibleResources = useMemo(() => filters.staffIds.length
    ? resources.filter(resource => filters.staffIds.includes(resource.id))
    : resources, [filters.staffIds, resources]);

  if (calendar.error) return <UnavailableState title="Task calendar unavailable" onRetry={calendar.retry} />;

  return <>
    <TimelineCalendar
      dateRange={filters.dateRange}
      rows={visibleResources}
      items={calendar.items}
      onInitialPeriods={calendar.initialize}
      onPeriodsBuilt={calendar.onPeriodsBuilt}
      onPeriodsReset={calendar.reset}
      getRowId={row => row.id}
      getItemId={getTaskId}
      getItemRange={getTaskRange}
      getItemCapabilities={({ data: task }) => (
        getTaskCalendarCapabilities(task, canWrite && task.writable, actions.isTaskPending(task.id))
      )}
      renderRow={({ row }) => <span aria-label={row.name}>{formatCompactPersonName(row.firstName, row.lastName)}</span>}
      selectedRowId={selectedResourceId}
      onRowSelect={row => onResourceSelect(row.id)}
      buildItem={({ data: task, calendar: itemCalendar }) => {
        const actionsAvailable = canWrite && task.writable && !actions.isTaskPending(task.id);
        return <TaskItem
          calendar={itemCalendar}
          task={task}
          selected={task.id === selectedTaskId}
          onComplete={actionsAvailable && canCompleteTask(task) ? () => void actions.setState(task, 'completed') : undefined}
          onCancel={actionsAvailable && canCancelTask(task) ? () => void actions.setState(task, 'cancelled') : undefined}
          onReopen={actionsAvailable && canReopenTask(task) ? () => void actions.setState(task, 'open') : undefined}
          onEdit={actionsAvailable && canEditTask(task) ? () => onEditTask(task) : undefined}
          onDelete={actionsAvailable && canDeleteTask(task) ? () => actions.requestDelete(task) : undefined}
        />;
      }}
      onItemActivate={({ data: task }) => onTaskSelect(task)}
      onCellActivate={canWrite ? ({ row, period }) => {
        if (row.writable) onAddTask({ startDate: period.key, dueDate: period.key, staffId: row.id });
      } : undefined}
      onItemResize={canWrite ? async ({ item: task, nextRange }) => {
        const updatedTask = await actions.setTaskRange(task, nextRange, 'resize');
        if (updatedTask) onTaskSelect(updatedTask);
      } : undefined}
      canItemMove={({ item: task, row, destinationRow }) => task.writable
        && !actions.isTaskPending(task.id)
        && destinationRow.writable
        && (row.id === destinationRow.id || canReassignTask(task))}
      onItemMove={canWrite ? async ({ item: task, nextRange, destinationRow }) => {
        const updatedTask = await actions.setTaskRange(task, nextRange, 'move', destinationRow.id);
        if (updatedTask) onTaskSelect(updatedTask);
      } : undefined}
      ariaLabel="Task calendar"
      positionStorageKey={TASK_CALENDAR_POSITION_KEY}
      rowHeader="Staff"
      rowHeight={112}
    />
  </>;
}
