import type { Task } from '../../../../common/features/tasks/types';

export function canCancelTask(task: Task) {
  return task.status === 'open';
}

export function canCompleteTask(task: Task) {
  return task.status === 'open' && task.hoursLogged > 0;
}

export function canReopenTask(task: Task) {
  return task.status === 'completed' || task.status === 'cancelled';
}

export function canEditTask(task: Task) {
  return task.status === 'open';
}

export function canDeleteTask(task: Task) {
  return task.hoursLogged === 0;
}
