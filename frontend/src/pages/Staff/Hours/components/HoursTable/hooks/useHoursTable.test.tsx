import { fireEvent, render, renderHook, screen } from '@testing-library/react';
import type { CellContext } from '@tanstack/react-table';
import { describe, expect, it, vi } from 'vitest';

import { makeHoursItem } from '../../../../../../tests/factories/hours';
import type { ColumnDef } from '@tanstack/react-table';
import type { Hours, HoursActions } from '../../../types';
import useHoursTable from './useHoursTable';

const writable = {
  id: 'staff-1', firstName: 'Zoe', lastName: 'Wilson', name: 'Zoe Wilson', role: 'staff', writable: true,
};
const row = makeHoursItem({ id: 'entry-1', taskId: 'task-1', taskTitle: 'Prepare workshop' });
const defaultActions: HoursActions = {
  isItemPending: () => false,
  add: vi.fn(),
  edit: vi.fn(),
  move: vi.fn().mockResolvedValue(undefined),
  requestDelete: vi.fn(),
};

function renderCell(column: ColumnDef<Hours>, item: Hours) {
  if (typeof column.cell !== 'function') throw new Error(`Column ${column.id} has no cell renderer`);
  return column.cell({ row: { original: item } } as CellContext<Hours, unknown>);
}

describe('useHoursTable', () => {
  it('omits row actions for read-only users', () => {
    const { result } = renderHook(() => useHoursTable({
      canWrite: false,
      staff: [],
      actions: defaultActions,
    }));

    expect(result.current.columns.some(column => column.id === 'actions')).toBe(false);
  });

  it('builds row actions only for writable staff', () => {
    const onEdit = vi.fn();
    const onDelete = vi.fn();
    const { result } = renderHook(() => useHoursTable({
      canWrite: true,
      staff: [writable],
      actions: { ...defaultActions, edit: onEdit, requestDelete: onDelete },
    }));
    const actionsColumn = result.current.columns.find(column => column.id === 'actions')!;
    render(<>{renderCell(actionsColumn, row)}</>);

    const trigger = screen.getByRole('button', { name: 'Actions for Prepare workshop on 2026-08-19' });
    fireEvent.click(trigger);
    fireEvent.click(screen.getByRole('menuitem', { name: 'Edit' }));
    fireEvent.click(trigger);
    fireEvent.click(screen.getByRole('menuitem', { name: 'Delete' }));
    expect(onEdit).toHaveBeenCalledWith(row);
    expect(onDelete).toHaveBeenCalledWith(row);
  });

  it('hides row actions for a read-only staff member in a writable table', () => {
    const { result } = renderHook(() => useHoursTable({
      canWrite: true,
      staff: [{ ...writable, writable: false }],
      actions: defaultActions,
    }));

    const actionsColumn = result.current.columns.find(column => column.id === 'actions')!;
    render(<>{renderCell(actionsColumn, row)}</>);

    expect(screen.queryByRole('button', { name: 'Actions for Prepare workshop on 2026-08-19' })).not.toBeInTheDocument();
  });

});
