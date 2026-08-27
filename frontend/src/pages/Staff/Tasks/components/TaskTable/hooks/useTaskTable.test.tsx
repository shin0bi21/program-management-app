// Owns task columns and permission-aware row actions.
import { render, renderHook, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { CellContext } from '@tanstack/react-table';
import { describe, expect, it, vi } from 'vitest';

import type { ActionItem } from '../../../../../../common/components/ActionsMenu/ActionsMenu';
import type { ColumnDef } from '@tanstack/react-table';
import type { Task } from '../../../types';
import { makeTask } from '../../../../../../tests/factories/task';
import useTaskTable from './useTaskTable';

const actionMenu = vi.hoisted<{ items: ActionItem[] }>(() => ({ items: [] }));

vi.mock('../../../../../../common/components/ActionsMenu/ActionsMenu', () => ({
  default: ({ items }: { items: ActionItem[] }) => {
    actionMenu.items = items;
    return <div data-testid="actions-menu" />;
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
  it('returns data columns only for read-only users', () => {
    const rendered = renderTable(false);
    const task = makeTask();

    expect(rendered.result.current.columns.map(column => [column.id, column.header])).toEqual([
      ['firstName', 'First Name'],
      ['lastName', 'Last Name'],
      ['title', 'Task'],
      ['program', 'Program'],
      ['category', 'Category'],
      ['startDate', 'Start'],
      ['dueDate', 'Due'],
      ['status', 'Status'],
    ]);
    expect(renderCell(rendered.result.current.columns.find(column => column.id === 'program')!, task)).toBe('—');

    const status = rendered.result.current.columns.find(column => column.id === 'status')!;
    render(<>{renderCell(status, task)}</>);
    expect(screen.getByText('Active')).toBeInTheDocument();
  });

  it('builds capability-gated actions and forwards the selected action', async () => {
    const user = userEvent.setup();
    const task = makeTask();
    const rendered = renderTable(true);
    const actionColumn = rendered.result.current.columns.find(column => column.id === 'actions')!;

    render(<>{renderCell(actionColumn, task)}</>);
    expect(screen.getByTestId('actions-menu')).toBeInTheDocument();
    expect(actionMenu.items.map(item => item.label)).toEqual(['Set Cancelled', 'Edit', 'Delete']);

    render(<button onClick={actionMenu.items[0].onClick}>Cancel</button>);
    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(rendered.actions.setState).toHaveBeenCalledWith(task, 'cancelled');
  });
});
