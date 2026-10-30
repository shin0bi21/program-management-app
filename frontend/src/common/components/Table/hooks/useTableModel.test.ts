import { renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import useTableModel from './useTableModel';
import type { TableColumnDef } from '../Table.types';

interface Row {
  id: string;
  name: string;
}

const columns: TableColumnDef<Row>[] = [
  { accessorKey: 'name', header: 'Name' },
  { id: 'actions', header: '', cell: () => null, enableResizing: false, enableHiding: false },
];

describe('useTableModel', () => {
  it('emits the canonical column key for table-declared sortable columns', () => {
    const onSortingChange = vi.fn();
    const { result } = renderHook(() => useTableModel({
      data: [],
      columns,
      hiddenColumnKeys: [],
      keyExtractor: row => row.id,
      sorting: { key: 'name', direction: 'asc' },
      sortableColumns: ['name'],
      onSortingChange,
      columnWidths: {},
    }));

    result.current.toggleSort('name');

    expect(onSortingChange).toHaveBeenCalledWith({ key: 'name', direction: 'desc' });
  });

  it('ignores columns outside the table sortable-key contract', () => {
    const onSortingChange = vi.fn();
    const { result } = renderHook(() => useTableModel({
      data: [],
      columns,
      hiddenColumnKeys: [],
      keyExtractor: row => row.id,
      sortableColumns: ['name'],
      onSortingChange,
      columnWidths: {},
    }));

    result.current.toggleSort('actions');

    expect(onSortingChange).not.toHaveBeenCalled();
  });

  it('fills spare viewport space within data-column limits while keeping actions fixed', () => {
    const sizingColumns: TableColumnDef<Row>[] = [
      { id: 'name', header: 'Name', size: 150, maxSize: 200 },
      { id: 'status', header: 'Status', size: 150 },
      { id: 'actions', header: '', size: 40, enableResizing: false },
    ];
    const { result, rerender } = renderHook(({ viewportWidth }) => useTableModel({
      data: [], columns: sizingColumns, hiddenColumnKeys: [], keyExtractor: row => row.id,
      sortableColumns: [], columnWidths: {}, viewportWidth,
    }), { initialProps: { viewportWidth: 640 } });

    expect(result.current.resolvedColumnWidths).toEqual({ name: 200, status: 400, actions: 40 });
    rerender({ viewportWidth: 1200 });
    expect(result.current.resolvedColumnWidths).toEqual({ name: 200, status: 500, actions: 40 });
    expect(result.current.totalWidth).toBe(740);
  });

  it('fills unused viewport space when restored widths are too small', () => {
    const { result } = renderHook(() => useTableModel({
      data: [], columns, hiddenColumnKeys: [], keyExtractor: row => row.id,
      sortableColumns: [], columnWidths: { name: 180 }, viewportWidth: 400,
    }));

    expect(result.current.resolvedColumnWidths).toEqual({ name: 360, actions: 40 });
    expect(result.current.totalWidth).toBe(400);
  });


  it('stops keyboard shrinking at the viewport width, excluding hidden columns', () => {
    const onColumnWidthsChange = vi.fn();
    const { result } = renderHook(() => useTableModel({
      data: [], columns: [...columns, { id: 'hidden', header: 'Hidden' }],
      hiddenColumnKeys: ['hidden'], keyExtractor: row => row.id, sortableColumns: [],
      columnWidths: { name: 360, hidden: 250 }, viewportWidth: 400, enableColumnResizing: true, onColumnWidthsChange,
    }));

    result.current.resizeColumnByStep('name', 360, 'ArrowLeft', { name: 360, hidden: 250 });

    expect(onColumnWidthsChange).toHaveBeenCalledWith({ name: 360, hidden: 250 });
  });

});
