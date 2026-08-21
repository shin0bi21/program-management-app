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
});
