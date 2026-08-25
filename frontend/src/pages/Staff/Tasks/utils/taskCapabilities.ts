import type { Task } from '../types';

export function canCancelTask(task: Task) {
  return task.state === 'open';
}

export function canCompleteTask(task: Task) {
  return task.state === 'open' && task.hoursLogged > 0;
}

export function canReopenTask(task: Task) {
  return task.state === 'completed' || task.state === 'cancelled';
}

export function canEditTask(task: Task) {
  return task.state === 'open';
}

export function canDeleteTask(task: Task) {
  return task.hoursLogged === 0;
}
