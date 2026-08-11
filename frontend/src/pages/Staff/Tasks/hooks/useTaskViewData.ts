import { useMemo } from 'react';
import type { ListSort } from '../../../../common/types/pagination';
import type { Task, TaskCategory, TaskResource, TaskStatus } from '../../../../common/features/tasks/types';

export type TaskSortKey = 'firstName' | 'lastName' | 'title' | 'category' | 'program' | 'cycle' | 'startDate' | 'dueDate' | 'status';

interface TaskViewFilters {
  search: string;
  programIds: readonly string[];
  cycleIds: readonly string[];
  categories: readonly TaskCategory[];
  statuses: readonly TaskStatus[];
}

function matchesTask(task: Task, filters: TaskViewFilters) {
  const search = filters.search.trim().toLocaleLowerCase();
  const matchesProgram = !filters.programIds.length
    || (task.programId !== null && filters.programIds.includes(task.programId));
  const matchesCycle = !filters.cycleIds.length || filters.cycleIds.includes(task.cycleId);
  const matchesCategory = !filters.categories.length || filters.categories.includes(task.category);
  const matchesStatus = !filters.statuses.length || filters.statuses.includes(task.status);
  const searchableFields = [
    task.title,
    task.details ?? '',
    task.programName ?? '',
    task.cycleName,
    task.assignee.name,
  ];
  const matchesSearch = !search
    || searchableFields.some(field => field.toLocaleLowerCase().includes(search));

  return matchesProgram && matchesCycle && matchesCategory && matchesStatus && matchesSearch;
}

function buildRangeData(tasks: readonly Task[], resources: readonly TaskResource[]) {
  const tasksByResource = new Map<string, Task[]>();
  tasks.forEach(task => {
    const resourceTasks = tasksByResource.get(task.assignee.id) ?? [];
    resourceTasks.push(task);
    tasksByResource.set(task.assignee.id, resourceTasks);
  });

  return Object.fromEntries(resources.map(resource => [
    resource.id,
    tasksByResource.get(resource.id) ?? [],
  ]));
}

function taskSortValue(task: Task, key: TaskSortKey) {
  const values: Record<TaskSortKey, string> = {
    firstName: task.assignee.firstName,
    lastName: task.assignee.lastName,
    title: task.title,
    category: task.category,
    program: task.programName ?? 'General',
    cycle: task.cycleName,
    startDate: task.startDate,
    dueDate: task.dueDate,
    status: task.status,
  };
  return values[key];
}

export function sortTasks(tasks: readonly Task[], sorting: ListSort<TaskSortKey>) {
  const direction = sorting.direction === 'asc' ? 1 : -1;
  return [...tasks].sort((left, right) => (
    direction * taskSortValue(left, sorting.key).localeCompare(taskSortValue(right, sorting.key), undefined, { numeric: true })
    || left.id.localeCompare(right.id)
  ));
}

export default function useTaskViewData(
  tasks: readonly Task[],
  resources: readonly TaskResource[],
  filters: TaskViewFilters,
  selectedResourceId: string | null,
  sorting: ListSort<TaskSortKey>,
) {
  return useMemo(() => {
    const filteredTasks = tasks.filter(task => matchesTask(task, filters));
    const rows = sortTasks(filteredTasks, sorting);
    const rangeData = buildRangeData(filteredTasks, resources);
    const resourceTasks = selectedResourceId
      ? tasks.filter(task => task.assignee.id === selectedResourceId)
      : [];
    return {
      rows,
      rangeData,
      dashboardTasks: selectedResourceId ? rangeData[selectedResourceId] ?? [] : rows,
      resourceTasks,
    };
  }, [filters, resources, selectedResourceId, sorting, tasks]);
}
