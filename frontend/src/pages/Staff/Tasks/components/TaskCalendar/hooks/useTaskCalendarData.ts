import { useMemo } from 'react';
import type { Task, TaskCategory, TaskListStatus } from '../../../../../../common/features/tasks/types';
import { getTaskListStatus } from '../../../utils/taskDates';

export interface TaskCalendarFilters {
  programIds: readonly string[];
  categories: readonly TaskCategory[];
  statuses: readonly TaskListStatus[];
}

function matchesTask(task: Task, filters: TaskCalendarFilters, today: string) {
  const matchesProgram = !filters.programIds.length
    || (task.programId !== null && filters.programIds.includes(task.programId));
  const matchesCategory = !filters.categories.length || filters.categories.includes(task.category);
  const matchesStatus = !filters.statuses.length
    || filters.statuses.includes(getTaskListStatus(task, today));

  return matchesProgram && matchesCategory && matchesStatus;
}

export function useTaskCalendarData(
  rangeData: Record<string, readonly Task[]>,
  filters: TaskCalendarFilters,
  today: string,
) {
  const { programIds, categories, statuses } = filters;

  return useMemo(() => {
    const activeFilters = { programIds, categories, statuses };
    return Object.fromEntries(
      Object.entries(rangeData).map(([resourceId, tasks]) => [
        resourceId,
        tasks.filter(task => matchesTask(task, activeFilters, today)),
      ]),
    );
  }, [categories, programIds, rangeData, statuses, today]);
}
