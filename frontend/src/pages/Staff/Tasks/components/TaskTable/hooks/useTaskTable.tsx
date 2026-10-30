import { useMemo } from 'react';

import type { TableColumnDef } from '../../../../../../common/components/Table/Table.types';
import type { Task } from '../../../types';

import TaskStatusLabel from '../../TaskStatusLabel/TaskStatusLabel';
import TaskActionsMenu, { type TaskTableActions } from '../TaskActionsMenu';

interface UseTaskTableOptions {
  canWrite: boolean;
  actions: TaskTableActions;
}

export default function useTaskTable({
  canWrite,
  actions,
}: UseTaskTableOptions) {
  const { isTaskPending, setState, edit, requestDelete } = actions;

  const columns = useMemo<TableColumnDef<Task>[]>(() => [
    {
      id: 'firstName',
      header: 'First Name',
      size: 150,
      accessorFn: task => task.assignee.firstName,
    },
    {
      id: 'lastName',
      header: 'Last Name',
      size: 150,
      accessorFn: task => task.assignee.lastName,
    },
    {
      id: 'title',
      header: 'Task',
      accessorFn: task => task.title,
    },
    {
      id: 'program',
      header: 'Program',
      size: 160,
      accessorFn: task => task.programName ?? '—',
    },
    {
      id: 'category',
      header: 'Category',
      size: 150,
      accessorFn: task => task.categoryLabel,
    },
    {
      id: 'startDate',
      header: 'Start',
      size: 120,
      accessorFn: task => task.startDate,
    },
    {
      id: 'dueDate',
      header: 'Due',
      size: 120,
      accessorFn: task => task.dueDate,
    },
    {
      id: 'status',
      header: 'Status',
      size: 150,
      accessorFn: task => task.status,
      cell: ({ row }) => <TaskStatusLabel task={row.original} />,
    },
    ...(canWrite ? [{
      id: 'actions',
      header: '',
      size: 40,
      enableResizing: false,
      enableHiding: false,
      cell: ({ row }: { row: { original: Task } }) => <TaskActionsMenu
        task={row.original}
        isTaskPending={isTaskPending}
        setState={setState}
        edit={edit}
        requestDelete={requestDelete}
      />,
    }] : []),
  ], [canWrite, edit, isTaskPending, requestDelete, setState]);

  return { columns };
}
