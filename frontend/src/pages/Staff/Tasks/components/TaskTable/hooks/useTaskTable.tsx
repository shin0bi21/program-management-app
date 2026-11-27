import { useMemo } from 'react';

import type { TableColumnDef } from '../../../../../../common/components/Table/Table.types';
import type { Task, TaskActions } from '../../../types';

import TaskStatusLabel from '../../TaskStatusLabel/TaskStatusLabel';
import TaskActionsMenu from '../TaskActionsMenu';

interface UseTaskTableOptions {
  canWrite: boolean;
  actions: TaskActions;
}

interface TaskTableResult {
  columns: TableColumnDef<Task>[];
}

/**
 * Supplies task columns and permitted row actions for the table.
 * @param options - Write capability and page-coordinated task commands.
 * @example useTaskTable({ canWrite, actions }).columns
 */
export default function useTaskTable({
  canWrite,
  actions,
}: UseTaskTableOptions): TaskTableResult {
  const columns = useMemo<TableColumnDef<Task>[]>(() => [
    {
      id: 'firstName',
      header: 'First Name',
      size: 150,
      accessorFn: task => task.firstName,
    },
    {
      id: 'lastName',
      header: 'Last Name',
      size: 150,
      accessorFn: task => task.lastName,
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
      accessorFn: task => task.program ?? '—',
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
      cell: ({ row }) => <TaskActionsMenu task={row.original} actions={actions} />,
    } satisfies TableColumnDef<Task>] : []),
  ], [actions, canWrite]);

  return { columns };
}
