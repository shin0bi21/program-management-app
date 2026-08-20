import { useCallback, useMemo } from 'react';

import ActionsMenu from '../../../../../../common/components/ActionsMenu/ActionsMenu';
import type { TableColumn } from '../../../../../../common/components/Table/Table';
import { TASK_CATEGORY_LABELS, type Task } from '../../../../../../common/features/tasks/types';
import type { ListSort } from '../../../../../../common/types/pagination';

import TaskStatusBadge from '../../TaskStatusBadge/TaskStatusBadge';
import type { TaskPreferences, TaskSortKey } from '../../../types';
import {
  canCancelTask,
  canCompleteTask,
  canDeleteTask,
  canEditTask,
  canReopenTask,
} from '../../../utils/taskCapabilities';

interface TaskTableActions {
  isTaskPending: (taskId: string) => boolean;
  setStatus: (task: Task, status: Task['status']) => Promise<void>;
  edit: (task: Task) => void;
  requestDelete: (task: Task) => void;
}

interface UseTaskTableOptions {
  canWrite: boolean;
  today: string;
  preferences: TaskPreferences;
  updatePreferences: (patch: Partial<TaskPreferences>) => void;
  actions: TaskTableActions;
}

export default function useTaskTable({
  canWrite,
  today,
  preferences,
  updatePreferences,
  actions,
}: UseTaskTableOptions) {
  const { isTaskPending, setStatus, edit, requestDelete } = actions;

  const columns = useMemo<TableColumn<Task>[]>(() => [
    {
      key: 'firstName',
      header: 'First Name',
      width: 150,
      render: task => task.assignee.firstName,
    },
    {
      key: 'lastName',
      header: 'Last Name',
      width: 150,
      render: task => task.assignee.lastName,
    },
    {
      key: 'title',
      header: 'Task',
      render: task => task.title,
    },
    {
      key: 'program',
      header: 'Program',
      width: 160,
      render: task => task.programName ?? '—',
    },
    {
      key: 'category',
      header: 'Category',
      width: 150,
      render: task => TASK_CATEGORY_LABELS[task.category],
    },
    {
      key: 'startDate',
      header: 'Start',
      width: 120,
      render: task => task.startDate,
    },
    {
      key: 'dueDate',
      header: 'Due',
      width: 120,
      render: task => task.dueDate,
    },
    {
      key: 'status',
      header: 'Status',
      width: 150,
      render: task => <TaskStatusBadge task={task} today={today} />,
    },
    ...(canWrite ? [{
      key: 'actions',
      header: '',
      width: 40,
      resizable: false,
      className: 'col-actions',
      render: (task: Task) => task.writable && !isTaskPending(task.id) ? <ActionsMenu
        ariaLabel={`Actions for ${task.title}`}
        items={[
          ...(canCompleteTask(task) ? [{
            id: 'complete',
            label: 'Set Completed',
            onClick: () => void setStatus(task, 'completed'),
          }] : []),
          ...(canCancelTask(task) ? [{
            id: 'cancel',
            label: 'Set Cancelled',
            onClick: () => void setStatus(task, 'cancelled'),
          }] : []),
          ...(canReopenTask(task) ? [{
            id: 'reopen',
            label: 'Reopen task',
            onClick: () => void setStatus(task, 'open'),
          }] : []),
          ...(canEditTask(task) ? [{
            id: 'edit',
            label: 'Edit',
            onClick: () => edit(task),
          }] : []),
          ...(canDeleteTask(task) ? [{
            id: 'delete',
            label: 'Delete',
            variant: 'danger' as const,
            onClick: () => requestDelete(task),
          }] : []),
        ]}
      /> : null,
    }] : []),
  ], [canWrite, edit, isTaskPending, requestDelete, setStatus, today]);

  const updateSorting = useCallback(
    (sorting: ListSort<TaskSortKey>) => updatePreferences({ sorting }),
    [updatePreferences],
  );
  const updateColumnWidths = useCallback(
    (columnWidths: Record<string, number>) => updatePreferences({ columnWidths }),
    [updatePreferences],
  );
  const updateHiddenColumns = useCallback(
    (hiddenColumns: string[]) => updatePreferences({ hiddenColumns }),
    [updatePreferences],
  );

  return {
    columns,
    sorting: preferences.sorting,
    columnWidths: preferences.columnWidths,
    hiddenColumns: preferences.hiddenColumns,
    updateSorting,
    updateColumnWidths,
    updateHiddenColumns,
  };
}
