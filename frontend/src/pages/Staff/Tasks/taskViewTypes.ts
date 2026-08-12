import type { Task } from '../../../common/features/tasks/types';

export type TaskSortKey = 'firstName' | 'lastName' | 'title' | 'category' | 'program' | 'startDate' | 'dueDate' | 'status';

export interface TaskViewMutationCache {
  upsert: (task: Task) => void;
  remove: (taskId: string) => void;
}

export interface TaskCalendarActions {
  requestDelete: (task: Task) => void;
  setStatus: (task: Task, status: Task['status']) => Promise<void>;
  setTaskRange: (
    task: Task,
    nextRange: { start: string; end: string },
    action: 'move' | 'resize',
    staffId?: string,
  ) => Promise<void>;
}
