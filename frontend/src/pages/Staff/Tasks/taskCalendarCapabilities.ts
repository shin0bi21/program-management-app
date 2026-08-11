import type { Task } from '../../../common/features/tasks/types';

export function getTaskCalendarCapabilities(task: Task, canWriteTask: boolean) {
  const canAdjustDates = canWriteTask && (task.status === 'todo' || task.status === 'in_progress');
  return { draggable: canAdjustDates, resizable: canAdjustDates };
}

export function canMoveTaskToResource(task: Task, sourceResourceId: string, destinationResourceId: string) {
  if (sourceResourceId === destinationResourceId) return true;
  return task.status === 'todo' && task.hoursLogged === 0;
}
