import ActionsMenu from '../../../../../common/components/ActionsMenu/ActionsMenu';
import type { Task } from '../../types';
import {
  canCancelTask,
  canCompleteTask,
  canDeleteTask,
  canEditTask,
  canReopenTask,
} from '../../utils/taskCapabilities';

export interface TaskTableActions {
  isTaskPending: (taskId: string) => boolean;
  setState: (task: Task, state: Task['state']) => Promise<void>;
  edit: (task: Task) => void;
  requestDelete: (task: Task) => void;
}

export default function TaskActionsMenu({
  task,
  isTaskPending,
  setState,
  edit,
  requestDelete,
}: TaskTableActions & { task: Task }) {
  if (!task.writable || isTaskPending(task.id)) return null;

  return <ActionsMenu
    ariaLabel={`Actions for ${task.title}`}
    items={[
      ...(canCompleteTask(task) ? [{ id: 'complete', label: 'Set Completed', onClick: () => void setState(task, 'completed') }] : []),
      ...(canCancelTask(task) ? [{ id: 'cancel', label: 'Set Cancelled', onClick: () => void setState(task, 'cancelled') }] : []),
      ...(canReopenTask(task) ? [{ id: 'reopen', label: 'Reopen task', onClick: () => void setState(task, 'open') }] : []),
      ...(canEditTask(task) ? [{ id: 'edit', label: 'Edit', onClick: () => edit(task) }] : []),
      ...(canDeleteTask(task) ? [{ id: 'delete', label: 'Delete', variant: 'danger' as const, onClick: () => requestDelete(task) }] : []),
    ]}
  />;
}
