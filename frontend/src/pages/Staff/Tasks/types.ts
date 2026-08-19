import type { TaskCategory, TaskStatus } from '../../../common/features/tasks/types';
import type { ListSort } from '../../../common/types/pagination';
import type { TaskSortKey } from './taskViewTypes';

export interface TaskPreference {
  view?: 'calendar' | 'list';
  staffIds?: string[];
  programIds: string[];
  categories: TaskCategory[];
  statuses: TaskStatus[];
  sorting?: ListSort<TaskSortKey>;
  columnWidths?: Record<string, number>;
  hiddenColumns?: string[];
}
