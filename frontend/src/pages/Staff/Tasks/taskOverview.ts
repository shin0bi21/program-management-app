import type { Task } from '../../../common/features/tasks/types';

const ACTIVE_TASK_STATUSES = new Set<Task['status']>(['todo', 'in_progress']);

function parseCalendarDate(value: string) {
  const [year, month, day] = value.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day));
}

function calendarDateKey(value: Date) {
  const year = value.getUTCFullYear();
  const month = String(value.getUTCMonth() + 1).padStart(2, '0');
  const day = String(value.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function currentWeekBounds(today: string) {
  const date = parseCalendarDate(today);
  const daysSinceMonday = (date.getUTCDay() + 6) % 7;
  const start = new Date(date);
  start.setUTCDate(date.getUTCDate() - daysSinceMonday);
  const end = new Date(start);
  end.setUTCDate(start.getUTCDate() + 6);
  return { start: calendarDateKey(start), end: calendarDateKey(end) };
}

function sortByDueDate(tasks: readonly Task[]) {
  return [...tasks].sort((left, right) => (
    left.dueDate.localeCompare(right.dueDate) || left.title.localeCompare(right.title)
  ));
}

export function isTaskActive(task: Task) {
  return ACTIVE_TASK_STATUSES.has(task.status);
}

export function isTaskOverdue(task: Task, today: string) {
  return isTaskActive(task) && task.dueDate < today;
}

export function groupTasksForOverview(tasks: readonly Task[], today: string) {
  const week = currentWeekBounds(today);
  const activeTasks = tasks.filter(isTaskActive);
  const overdueTasks = activeTasks.filter(task => isTaskOverdue(task, today));
  const upcomingTasks = activeTasks.filter(task => task.dueDate >= today);
  const dueThisWeekTasks = upcomingTasks.filter(task => task.dueDate <= week.end);
  return {
    activeTasks: sortByDueDate(activeTasks),
    overdueTasks: sortByDueDate(overdueTasks),
    upcomingTasks: sortByDueDate(upcomingTasks),
    dueThisWeekTasks: sortByDueDate(dueThisWeekTasks),
  };
}
