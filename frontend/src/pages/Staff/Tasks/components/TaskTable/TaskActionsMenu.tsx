import type { ReactElement } from 'react';
import ActionsMenu from '../../../../../common/components/ActionsMenu/ActionsMenu';
import type { Task, TaskActions } from '../../types';
import {
  canCancelTask,
  canCompleteTask,
  canDeleteTask,
  canEditTask,
  canReopenTask,
} from '../../utils/taskCapabilities';

type TaskActionsMenuProps = {
  task: Task;
  actions: TaskActions;
};

/**
 * Displays permitted lifecycle, edit, and delete commands for an available task.
 * @param props - Saved task and page-coordinated action callbacks.
 * @example <TaskActionsMenu task={task} actions={actions} />
 */
export default function TaskActionsMenu({
  task,
  actions,
}: TaskActionsMenuProps): ReactElement | null {
  const { isTaskPending, setState, edit, requestDelete } = actions;
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
