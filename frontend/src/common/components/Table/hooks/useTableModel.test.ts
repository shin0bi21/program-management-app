import { renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { TableColumn } from '../Table.types';
import useTableModel from './useTableModel';

interface Row {
  id: string;
  name: string;
}

const columns: TableColumn<Row>[] = [
  { key: 'name', header: 'Name', render: row => row.name },
  { key: 'actions', header: '', render: () => null, resizable: false },
];

describe('useTableModel', () => {
  it('emits the canonical column key for table-declared sortable columns', () => {
    const onSortingChange = vi.fn();
    const { result } = renderHook(() => useTableModel({
      data: [],
      columns,
      sorting: { key: 'name', direction: 'asc' },
      sortableColumns: ['name'],
      onSortingChange,
      columnWidths: {},
    }));

    result.current.toggleSort(columns[0]);

    expect(onSortingChange).toHaveBeenCalledWith({ key: 'name', direction: 'desc' });
  });

  it('ignores columns outside the table sortable-key contract', () => {
    const onSortingChange = vi.fn();
    const { result } = renderHook(() => useTableModel({
      data: [],
      columns,
      sortableColumns: ['name'],
      onSortingChange,
      columnWidths: {},
    }));

    result.current.toggleSort(columns[1]);

    expect(onSortingChange).not.toHaveBeenCalled();
  });
});
