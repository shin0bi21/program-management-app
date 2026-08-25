import { useCallback, useEffect, useMemo } from 'react';
import ResourceCalendar from '../../../../../common/components/ResourceCalendar/ResourceCalendar';
import { usePeriodDataBuffer } from '../../../../../common/components/ResourceCalendar/data/usePeriodDataBuffer';
import type { PeriodRange } from '../../../../../common/components/ResourceCalendar/data/PeriodDataBuffer';
import { getTasksCalendarData } from '../../tasks.api';
import type { Task, TaskResource, TasksFilters } from '../../types';
import { formatCompactPersonName } from '../../../../../common/utils/name';
import type { AddTaskModalInitialValues, TaskCalendarCache } from '../../types';
import {
  canCancelTask, canCompleteTask, canDeleteTask, canEditTask, canReopenTask,
} from '../../utils/taskCapabilities';
import TaskItem from './TaskItem/TaskItem';

const TASK_CALENDAR_POSITION_KEY = 'resource-calendar:tasks:position';

function getTaskCalendarCapabilities(task: Task, canWriteTask: boolean) {
  const canAdjustDates = canWriteTask && canEditTask(task);
  return { draggable: canAdjustDates, resizable: canAdjustDates };
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
}

export default function TaskCalendar({
  resources, filters, canWrite, selectedResourceId, selectedTaskId, actions, calendarCacheRef,
  onTaskSelect, onResourceSelect, onAddTask, onEditTask,
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
  const calendar = usePeriodDataBuffer({
    load: loadRange,
    getItemId: task => task.id,
    errorMessage: 'Unable to load task calendar data',
  });
  const { upsertItem, removeItem } = calendar;
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

  return <>
    {calendar.error && <p className="form-error" role="alert">{calendar.error}</p>}
    <ResourceCalendar
      resources={visibleResources}
      data={{}}
      rangeData={calendar.rangeData}
      onInitialPeriods={calendar.initialize}
      onPeriodsBuilt={calendar.onPeriodsBuilt}
      onPeriodsReset={calendar.reset}
      getResourceId={resource => resource.id}
      getItemId={task => task.id}
      getItemRange={task => ({ start: task.startDate, end: task.dueDate })}
      getItemCapabilities={({ data: task, range }) => range
        ? getTaskCalendarCapabilities(task, canWrite && task.writable && !actions.isTaskPending(task.id))
        : { draggable: canWrite && task.writable && !actions.isTaskPending(task.id) }}
      renderResource={({ resource }) => <span aria-label={resource.name}>{formatCompactPersonName(resource.firstName, resource.lastName)}</span>}
      selectedResourceId={selectedResourceId}
      onResourceSelect={resource => onResourceSelect(resource.id)}
      buildItem={() => null}
      buildRangeItem={({ data: task }) => {
        const actionsAvailable = canWrite && task.writable && !actions.isTaskPending(task.id);
        return <TaskItem
          task={task}
          selected={task.id === selectedTaskId}
          onActivate={() => onTaskSelect(task)}
          onComplete={actionsAvailable && canCompleteTask(task) ? () => void actions.setState(task, 'completed') : undefined}
          onCancel={actionsAvailable && canCancelTask(task) ? () => void actions.setState(task, 'cancelled') : undefined}
          onReopen={actionsAvailable && canReopenTask(task) ? () => void actions.setState(task, 'open') : undefined}
          onEdit={actionsAvailable && canEditTask(task) ? () => onEditTask(task) : undefined}
          onDelete={actionsAvailable && canDeleteTask(task) ? () => actions.requestDelete(task) : undefined}
        />;
      }}
      onCellActivate={canWrite ? ({ resource, period }) => {
        if (resource.writable) onAddTask({ startDate: period.key, dueDate: period.key, staffId: resource.id });
      } : undefined}
      onRangeResize={canWrite ? async ({ item: task, nextRange }) => {
        const updatedTask = await actions.setTaskRange(task, nextRange, 'resize');
        if (updatedTask) onTaskSelect(updatedTask);
      } : undefined}
      canRangeMove={({ item: task, resource, destinationResource }) => task.writable
        && !actions.isTaskPending(task.id)
        && destinationResource.writable
        && (resource.id === destinationResource.id || canReassignTask(task))}
      onRangeMove={canWrite ? async ({ item: task, nextRange, destinationResource }) => {
        const updatedTask = await actions.setTaskRange(task, nextRange, 'move', destinationResource.id);
        if (updatedTask) onTaskSelect(updatedTask);
      } : undefined}
      ariaLabel="Task calendar"
      positionStorageKey={TASK_CALENDAR_POSITION_KEY}
      resourceHeader="Staff"
      rowHeight={112}
    />
  </>;
}
