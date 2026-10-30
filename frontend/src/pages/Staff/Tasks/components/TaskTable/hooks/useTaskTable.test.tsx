import { render, renderHook } from '@testing-library/react';
import type { CellContext, ColumnDef } from '@tanstack/react-table';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { Task } from '../../../types';
import { makeTask } from '../../../../../../tests/factories/task';
import type { TaskTableActions } from '../TaskActionsMenu';
import useTaskTable from './useTaskTable';

const taskActionsMenu = vi.hoisted(() => vi.fn());

vi.mock('../TaskActionsMenu', () => ({
  default: (props: TaskTableActions & { task: Task }) => {
    taskActionsMenu(props);
    return <div data-testid="task-actions-menu" />;
  },
}));

function renderTable(canWrite: boolean) {
  const actions = {
    isTaskPending: vi.fn(() => false),
    setState: vi.fn().mockResolvedValue(undefined),
    edit: vi.fn(),
    requestDelete: vi.fn(),
  };
  const rendered = renderHook(() => useTaskTable({
    canWrite,
    actions,
  }));
  return { ...rendered, actions };
}

function renderCell(column: ColumnDef<Task>, task: Task) {
  if (typeof column.cell === 'function') {
    return column.cell({ row: { original: task } } as CellContext<Task, unknown>);
  }
  if ('accessorFn' in column && column.accessorFn) return column.accessorFn(task, 0);
  throw new Error(`Column ${column.id} has no value accessor or cell renderer`);
}

describe('useTaskTable', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns data columns only for read-only users', () => {
    const rendered = renderTable(false);
    const task = makeTask();

    expect(rendered.result.current.columns.some(column => column.id === 'actions')).toBe(false);
    expect(renderCell(rendered.result.current.columns.find(column => column.id === 'program')!, task)).toBe('—');
  });

  it('adds the action column for writers and wires its task and action contract', () => {
    const task = makeTask();
    const rendered = renderTable(true);
    const actionColumn = rendered.result.current.columns.find(column => column.id === 'actions')!;

    render(<>{renderCell(actionColumn, task)}</>);
    expect(taskActionsMenu).toHaveBeenCalledWith({
      task,
      isTaskPending: rendered.actions.isTaskPending,
      setState: rendered.actions.setState,
      edit: rendered.actions.edit,
      requestDelete: rendered.actions.requestDelete,
    });
  });
});
