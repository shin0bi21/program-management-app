import type { Task } from '../../../../common/features/tasks/types';

export function isTaskOverdue(task: Task, today: string) {
  const isActive = task.status === 'todo' || task.status === 'in_progress';
  return isActive && task.dueDate < today;
}
