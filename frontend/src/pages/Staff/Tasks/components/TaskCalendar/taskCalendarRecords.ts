import type { DateRange } from '../../../../../common/utils/dateRange';
import type { Task } from '../../types';

/** Gets the stable task ID used by the calendar and its buffer. @example getTaskId(task) // task.id */
export function getTaskId(task: Task): Task['id'] {
  return task.id;
}

/** Gets the inclusive dates occupied by a task. @example getTaskRange(task) // { start: task.startDate, end: task.dueDate } */
export function getTaskRange(task: Task): DateRange {
  return { start: task.startDate, end: task.dueDate };
}
