import { useCallback, useMemo } from 'react';
import {
  getCoreRowModel,
  useReactTable,
  type ColumnDef,
  type ColumnSizingState,
  type SortingState,
} from '@tanstack/react-table';
import type { TableColumn, TableSorting } from '../Table.types';
import {
  DEFAULT_COLUMN_WIDTH,
  FIXED_COLUMN_WIDTH,
  MAX_COLUMN_WIDTH,
  MIN_COLUMN_WIDTH,
  RESIZE_KEYBOARD_STEP,
  clampColumnWidth,
} from '../table.utils';

interface UseTableModelOptions<T> {
  data: T[];
  columns: TableColumn<T>[];
  sorting?: TableSorting;
  onSortingChange?: (sorting: TableSorting) => void;
  columnWidths: ColumnSizingState;
  onColumnWidthsChange?: (widths: ColumnSizingState) => void;
}

export default function useTableModel<T>({
  data,
  columns,
  sorting,
  onSortingChange,
  columnWidths,
  onColumnWidthsChange,
}: UseTableModelOptions<T>) {
  const tanstackColumns = useMemo<ColumnDef<T>[]>(() => columns.map(column => {
    const fixedWidth = column.resizable === false;
    const fixedSize = column.width ?? FIXED_COLUMN_WIDTH;

    return {
      id: column.key,
      accessorFn: row => row,
      header: column.header,
      cell: context => column.render(context.row.original),
      enableSorting: Boolean(column.sortKey),
      enableResizing: !fixedWidth,
      size: fixedWidth ? fixedSize : column.width ?? DEFAULT_COLUMN_WIDTH,
      minSize: fixedWidth ? fixedSize : MIN_COLUMN_WIDTH,
      maxSize: fixedWidth ? fixedSize : MAX_COLUMN_WIDTH,
      meta: column,
    };
  }), [columns]);

  const sortingState = useMemo<SortingState>(() => {
    if (!sorting) return [];
    const columnId = columns.find(column => column.sortKey === sorting.key)?.key ?? sorting.key;
    return [{ id: columnId, desc: sorting.direction === 'desc' }];
  }, [columns, sorting]);

  const normalizeColumnWidths = useCallback((next: ColumnSizingState): ColumnSizingState => Object.fromEntries(
    columns.flatMap(column => {
      if (column.resizable === false) return [];
      const width = next[column.key];
      return Number.isFinite(width) ? [[column.key, clampColumnWidth(width)]] : [];
    }),
  ), [columns]);

  const handleColumnSizingChange = useCallback((updater: ColumnSizingState | ((current: ColumnSizingState) => ColumnSizingState)) => {
    if (!onColumnWidthsChange) return;
    const next = typeof updater === 'function' ? updater(columnWidths) : updater;
    onColumnWidthsChange(normalizeColumnWidths(next));
  }, [columnWidths, normalizeColumnWidths, onColumnWidthsChange]);

  const table = useReactTable({
    data,
    columns: tanstackColumns,
    state: { sorting: sortingState, columnSizing: columnWidths },
    manualSorting: true,
    enableMultiSort: false,
    columnResizeMode: 'onChange',
    onColumnSizingChange: handleColumnSizingChange,
    getCoreRowModel: getCoreRowModel(),
  });

  const toggleSort = useCallback((column: TableColumn<T>) => {
    if (!column.sortKey || !onSortingChange) return;
    const ascending = sorting?.key === column.sortKey && sorting.direction === 'asc';
    onSortingChange({
      key: column.sortKey,
      direction: ascending ? 'desc' : 'asc',
    });
  }, [onSortingChange, sorting]);

  const nudgeColumnWidth = useCallback((
    columnId: string,
    currentWidth: number,
    direction: 'ArrowLeft' | 'ArrowRight',
    lockedWidths?: ColumnSizingState,
  ) => {
    if (!onColumnWidthsChange) return;
    const delta = direction === 'ArrowLeft' ? -RESIZE_KEYBOARD_STEP : RESIZE_KEYBOARD_STEP;
    onColumnWidthsChange({
      ...columnWidths,
      ...lockedWidths,
      [columnId]: clampColumnWidth(currentWidth + delta),
    });
  }, [columnWidths, onColumnWidthsChange]);

  return {
    headers: table.getHeaderGroups()[0].headers,
    isResizing: Boolean(table.getState().columnSizingInfo.isResizingColumn),
    nudgeColumnWidth,
    resolvedColumnWidths: Object.fromEntries(
      table.getAllLeafColumns().map(column => [column.id, column.getSize()]),
    ),
    toggleSort,
    totalWidth: table.getTotalSize(),
  };
}
