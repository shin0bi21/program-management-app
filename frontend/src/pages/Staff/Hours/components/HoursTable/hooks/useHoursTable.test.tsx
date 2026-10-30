import { fireEvent, render, renderHook, screen } from '@testing-library/react';
import type { CellContext } from '@tanstack/react-table';
import { describe, expect, it, vi } from 'vitest';

import { makeHoursItem } from '../../../../../../tests/factories/hours';
import type { ColumnDef } from '@tanstack/react-table';
import type { HoursTableRow } from '../../../types';
import useHoursTable from './useHoursTable';

const writable = {
  id: 'staff-1', firstName: 'Zoe', lastName: 'Wilson', name: 'Zoe Wilson', role: 'staff', writable: true,
};
const row: HoursTableRow = {
  id: 'entry-1', resourceId: 'staff-1', date: '2026-08-19',
  staffFirstName: 'Zoe', staffLastName: 'Wilson', staffName: 'Zoe Wilson',
  item: makeHoursItem({ id: 'entry-1', taskId: 'task-1', taskTitle: 'Prepare workshop' }),
};

function renderCell(column: ColumnDef<HoursTableRow>, item: HoursTableRow) {
  if (typeof column.cell !== 'function') throw new Error(`Column ${column.id} has no cell renderer`);
  return column.cell({ row: { original: item } } as CellContext<HoursTableRow, unknown>);
}

describe('useHoursTable', () => {
  it('omits row actions for read-only users', () => {
    const { result } = renderHook(() => useHoursTable({
      canWrite: false,
      resourcesById: new Map(),
      isEntryPending: () => false,
      onEdit: vi.fn(),
      onDelete: vi.fn(),
    }));

    expect(result.current.columns.some(column => column.id === 'actions')).toBe(false);
  });

  it('builds row actions only for writable resources', () => {
    const onEdit = vi.fn();
    const onDelete = vi.fn();
    const { result } = renderHook(() => useHoursTable({
      canWrite: true,
      resourcesById: new Map([[writable.id, writable]]),
      isEntryPending: () => false,
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

});
