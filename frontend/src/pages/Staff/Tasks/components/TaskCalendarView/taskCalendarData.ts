import type { Task, TaskCategory, TaskStatus } from '../../../../../common/features/tasks/types';

export interface TaskCalendarFilters {
  search: string;
  programIds: readonly string[];
  categories: readonly TaskCategory[];
  statuses: readonly TaskStatus[];
}

export function matchesTask(task: Task, filters: TaskCalendarFilters) {
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
