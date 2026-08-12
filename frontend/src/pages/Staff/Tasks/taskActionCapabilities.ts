import type { Task } from '../../../common/features/tasks/types';

export function canCancelTask(task: Task) {
  return task.status === 'todo' || task.status === 'in_progress';
}

export function canCompleteTask(task: Task) {
  return task.status === 'in_progress';
}

export function canReopenTask(task: Task) {
  return task.status === 'completed' || task.status === 'cancelled';
}

export function canEditTask(task: Task) {
  return task.status === 'todo' || task.status === 'in_progress';
}

export function canDeleteTask(task: Task) {
  return task.status !== 'completed' && task.hoursLogged === 0;
}

export function reopenedTaskStatus(task: Task): 'todo' | 'in_progress' {
  return task.status === 'completed' || task.hoursLogged > 0 ? 'in_progress' : 'todo';
}
