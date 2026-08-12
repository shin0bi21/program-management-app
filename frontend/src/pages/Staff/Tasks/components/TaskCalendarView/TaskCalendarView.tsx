import { useCallback, useEffect, useMemo } from 'react';
import ResourceCalendar from '../../../../../common/components/ResourceCalendar/ResourceCalendar';
import { usePeriodDataBuffer } from '../../../../../common/components/ResourceCalendar/hooks/usePeriodDataBuffer';
import type { PeriodRange } from '../../../../../common/components/ResourceCalendar/PeriodDataBuffer';
import { getTasks } from '../../../../../common/features/tasks/api/tasks.api';
import type { Task, TaskCategory, TaskResource, TaskStatus } from '../../../../../common/features/tasks/types';
import { formatCompactPersonName } from '../../../../../common/utils/name';
import { canMoveTaskToResource, getTaskCalendarCapabilities } from '../../taskCalendarCapabilities';
import { matchesTask } from '../../hooks/useTaskViewData';
import type useTaskMutations from '../../hooks/useTaskMutations';
import TaskItem from '../TaskItem/TaskItem';
import type { TaskModalTarget } from '../TaskDialogs/TaskDialogs';
import type { TaskViewMutationCache } from '../TaskListView/TaskListView';

const TASK_CALENDAR_POSITION_KEY = 'resource-calendar:tasks:position';

function canCancelTask(task: Task) { return task.status === 'todo' || task.status === 'in_progress'; }
function canCompleteTask(task: Task) { return task.status === 'in_progress'; }
function canReopenTask(task: Task) { return task.status === 'completed' || task.status === 'cancelled'; }
function reopenedStatus(task: Task): 'todo' | 'in_progress' {
  return task.status === 'completed' || task.hoursLogged > 0 ? 'in_progress' : 'todo';
}

interface TaskCalendarViewProps {
  resources: TaskResource[];
  filters: { programIds: string[]; categories: TaskCategory[]; statuses: TaskStatus[] };
  canWrite: boolean;
  selectedResourceId: string | null;
  selectedTaskId: string | null;
  mutations: ReturnType<typeof useTaskMutations>;
  mutationCacheRef: React.MutableRefObject<TaskViewMutationCache>;
  onTaskSelect: (task: Task) => void;
  onResourceSelect: (resourceId: string) => void;
  onModalTargetChange: (target: TaskModalTarget) => void;
}

export default function TaskCalendarView({
  resources, filters, canWrite, selectedResourceId, selectedTaskId, mutations, mutationCacheRef,
  onTaskSelect, onResourceSelect, onModalTargetChange,
}: TaskCalendarViewProps) {
  const loadRange = useCallback(async ({ start, end }: PeriodRange) => {
    const tasks = await getTasks({ start: start.key, end: end.key, includeClosed: true });
    return tasks.reduce<Record<string, Record<string, Task[]>>>((data, task) => {
      data[task.assignee.id] ??= {};
      data[task.assignee.id][start.key] ??= [];
      data[task.assignee.id][start.key].push(task);
      return data;
    }, {});
  }, []);
  const calendar = usePeriodDataBuffer({
    load: loadRange,
    getItemId: task => task.id,
    errorMessage: 'Unable to load task calendar data',
  });
  useEffect(() => {
    mutationCacheRef.current = {
      upsert: task => calendar.upsertItem(task.assignee.id, task.startDate, task),
      remove: calendar.removeItem,
    };
    return () => { mutationCacheRef.current = { upsert: () => undefined, remove: () => undefined }; };
  }, [calendar, mutationCacheRef]);
  const rangeData = useMemo(() => Object.fromEntries(
    Object.entries(calendar.rangeData).map(([resourceId, tasks]) => [
      resourceId,
      tasks.filter(task => matchesTask(task, { ...filters, search: '' })),
    ]),
  ), [calendar.rangeData, filters]);

  return <>
    {calendar.error && <p className="form-error" role="alert">{calendar.error}</p>}
    <ResourceCalendar
      resources={resources}
      data={{}}
      rangeData={rangeData}
      onInitialPeriods={calendar.initialize}
      onPeriodsBuilt={calendar.onPeriodsBuilt}
      onPeriodsReset={calendar.reset}
      getResourceId={resource => resource.id}
      getItemId={task => task.id}
      getItemRange={task => ({ start: task.startDate, end: task.dueDate })}
      getItemCapabilities={({ data: task, range }) => range
        ? getTaskCalendarCapabilities(task, canWrite && task.writable)
        : { draggable: canWrite && task.writable }}
      renderResource={({ resource }) => <span aria-label={resource.name}>{formatCompactPersonName(resource.firstName, resource.lastName)}</span>}
      selectedResourceId={selectedResourceId}
      onResourceSelect={resource => onResourceSelect(resource.id)}
      buildItem={() => null}
      buildRangeItem={({ data: task }) => <TaskItem
        task={task}
        selected={task.id === selectedTaskId}
        onActivate={() => onTaskSelect(task)}
        onComplete={canWrite && task.writable && canCompleteTask(task) ? () => void mutations.setStatus(task, 'completed') : undefined}
        onCancel={canWrite && task.writable && canCancelTask(task) ? () => void mutations.setStatus(task, 'cancelled') : undefined}
        onReopen={canWrite && task.writable && canReopenTask(task) ? () => void mutations.setStatus(task, reopenedStatus(task)) : undefined}
        onEdit={canWrite && task.writable ? () => onModalTargetChange(task) : undefined}
        onDelete={canWrite && task.writable ? () => mutations.requestDelete(task) : undefined}
      />}
      onCellActivate={canWrite ? ({ resource, period }) => {
        if (resource.writable) onModalTargetChange({ startDate: period.key, dueDate: period.key, fixedStaffId: resource.id });
      } : undefined}
      onRangeResize={canWrite ? ({ item: task, nextRange }) => {
        onTaskSelect(task);
        return mutations.setTaskRange(task, nextRange, 'resize');
      } : undefined}
      canRangeMove={({ item: task, resource, destinationResource }) => task.writable
        && destinationResource.writable
        && canMoveTaskToResource(task, resource.id, destinationResource.id)}
      onRangeMove={canWrite ? ({ item: task, nextRange, destinationResource }) => {
        onResourceSelect(destinationResource.id);
        onTaskSelect(task);
        return mutations.setTaskRange(task, nextRange, 'move', destinationResource.id);
      } : undefined}
      ariaLabel="Task calendar"
      positionStorageKey={TASK_CALENDAR_POSITION_KEY}
      resourceHeader="Staff"
      rowHeight={112}
    />
  </>;
}
