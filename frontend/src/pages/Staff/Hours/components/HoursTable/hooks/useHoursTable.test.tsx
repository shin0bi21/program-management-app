import { fireEvent, render, renderHook, screen } from '@testing-library/react';
import type { CellContext } from '@tanstack/react-table';
import { describe, expect, it, vi } from 'vitest';

import { makeHoursItem } from '../../../../../../tests/factories/hours';
import type { ColumnDef } from '@tanstack/react-table';
import type { HoursItem } from '../../../types';
import useHoursTable from './useHoursTable';

const writable = {
  id: 'staff-1', firstName: 'Zoe', lastName: 'Wilson', name: 'Zoe Wilson', role: 'staff', writable: true,
};
const row = makeHoursItem({ id: 'entry-1', taskId: 'task-1', taskTitle: 'Prepare workshop' });

function renderCell(column: ColumnDef<HoursItem>, item: HoursItem) {
  if (typeof column.cell !== 'function') throw new Error(`Column ${column.id} has no cell renderer`);
  return column.cell({ row: { original: item } } as CellContext<HoursItem, unknown>);
}

describe('useHoursTable', () => {
  it('omits row actions for read-only users', () => {
    const { result } = renderHook(() => useHoursTable({
      canWrite: false,
      staffById: new Map(),
      isItemPending: () => false,
      onEdit: vi.fn(),
      onDelete: vi.fn(),
    }));

    expect(result.current.columns.some(column => column.id === 'actions')).toBe(false);
  });

  it('builds row actions only for writable staff', () => {
    const onEdit = vi.fn();
    const onDelete = vi.fn();
    const { result } = renderHook(() => useHoursTable({
      canWrite: true,
      staffById: new Map([[writable.id, writable]]),
      isItemPending: () => false,
      onEdit,
      onDelete,
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
      staffById: new Map([['staff-1', { ...writable, writable: false }]]),
      isItemPending: () => false,
      onEdit: vi.fn(),
      onDelete: vi.fn(),
    }));

    const actionsColumn = result.current.columns.find(column => column.id === 'actions')!;
    render(<>{renderCell(actionsColumn, row)}</>);

    expect(screen.queryByRole('button', { name: 'Actions for Prepare workshop on 2026-08-19' })).not.toBeInTheDocument();
  });

});
