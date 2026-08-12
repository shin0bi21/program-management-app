import { useMemo } from 'react';
import type { Task, TaskCategory, TaskStatus } from '../../../../../../common/features/tasks/types';

export interface TaskCalendarFilters {
  search: string;
  programIds: readonly string[];
  categories: readonly TaskCategory[];
  statuses: readonly TaskStatus[];
}

function matchesTask(task: Task, filters: TaskCalendarFilters) {
  const search = filters.search.trim().toLocaleLowerCase();
  const matchesProgram = !filters.programIds.length
    || (task.programId !== null && filters.programIds.includes(task.programId));
  const matchesCategory = !filters.categories.length || filters.categories.includes(task.category);
  const matchesStatus = !filters.statuses.length || filters.statuses.includes(task.status);
  const searchableFields = [task.title, task.details ?? '', task.programName ?? '', task.assignee.name];
  const matchesSearch = !search
    || searchableFields.some(field => field.toLocaleLowerCase().includes(search));

  return matchesProgram && matchesCategory && matchesStatus && matchesSearch;
}

export function useTaskCalendarData(
  rangeData: Record<string, readonly Task[]>,
  filters: TaskCalendarFilters,
) {
  const { search, programIds, categories, statuses } = filters;

  return useMemo(() => {
    const activeFilters = { search, programIds, categories, statuses };
    return Object.fromEntries(
      Object.entries(rangeData).map(([resourceId, tasks]) => [
        resourceId,
        tasks.filter(task => matchesTask(task, activeFilters)),
      ]),
    );
  }, [categories, programIds, rangeData, search, statuses]);
}
