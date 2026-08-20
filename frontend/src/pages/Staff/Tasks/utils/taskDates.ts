import type { Task, TaskListStatus, TaskTiming } from '../../../../common/features/tasks/types';

export function getTaskTiming(task: Task, today: string): TaskTiming {
  if (task.startDate > today) return 'upcoming';
  if (task.dueDate < today) return 'overdue';
  return 'active';
}

export function getTaskListStatus(task: Task, today: string): TaskListStatus {
  return task.status === 'open' ? getTaskTiming(task, today) : task.status;
}
