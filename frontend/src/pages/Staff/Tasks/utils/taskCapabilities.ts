import type { Task } from '../types';

/**
 * Checks whether a task is still open for cancellation.
 * @param task - Saved task whose lifecycle and logged hours determine eligibility.
 * @example canCancelTask(task) // false for a completed task
 */
export function canCancelTask(task: Task): boolean {
  return task.state === 'open';
}

/**
 * Checks whether an open task has logged hours required for completion.
 * @param task - Saved task whose lifecycle and logged hours determine eligibility.
 * @example canCompleteTask(task) // false before hours are logged
 */
export function canCompleteTask(task: Task): boolean {
  return task.state === 'open' && task.hoursLogged > 0;
}

/**
 * Checks whether a task has a terminal state that can be reopened.
 * @param task - Saved task whose lifecycle and logged hours determine eligibility.
 * @example canReopenTask(task) // true for a cancelled task
 */
export function canReopenTask(task: Task): boolean {
  return task.state === 'completed' || task.state === 'cancelled';
}

/**
 * Checks whether an open task can have its details or dates edited.
 * @param task - Saved task whose lifecycle and logged hours determine eligibility.
 * @example canEditTask(task) // false for a completed task
 */
export function canEditTask(task: Task): boolean {
  return task.state === 'open';
}

/**
 * Checks whether a task has no logged hours preventing deletion.
 * @param task - Saved task whose lifecycle and logged hours determine eligibility.
 * @example canDeleteTask(task) // false after hours are logged
 */
export function canDeleteTask(task: Task): boolean {
  return task.hoursLogged === 0;
}
