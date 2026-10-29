import { useCallback, useMemo } from 'react';
import {
  getCoreRowModel,
  useReactTable,
  type ColumnDef,
  type VisibilityState,
  type ColumnSizingState,
  type SortingState,
} from '@tanstack/react-table';
import {
  getTableColumnCanHide,
  getTableColumnId,
  type TableColumnDef,
  type TableSorting,
} from '../Table.types';
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
  columns: TableColumnDef<T, unknown>[];
  hiddenColumnKeys: string[];
  keyExtractor: (item: T) => string;
  sorting?: TableSorting;
  sortableColumns: readonly string[];
  onSortingChange?: (sorting: TableSorting) => void;
  columnWidths: ColumnSizingState;
  onColumnWidthsChange?: (widths: ColumnSizingState) => void;
}

export default function useTableModel<T>({
  data,
  columns,
  hiddenColumnKeys,
  keyExtractor,
  sorting,
  sortableColumns,
  onSortingChange,
  columnWidths,
  onColumnWidthsChange,
}: UseTableModelOptions<T>) {

  // Apply shared controlled sorting and sizing policy to native TanStack columns.
  const tanstackColumns = useMemo<ColumnDef<T>[]>(() => columns.map(column => {
    const key = getTableColumnId(column);
    const fixedWidth = column.enableResizing === false;
    const configuredSize = column.size;
    const fixedSize = configuredSize ?? FIXED_COLUMN_WIDTH;

    return {
      ...column,
      id: key,
      enableSorting: sortableColumns.includes(key),
      enableResizing: !fixedWidth,
      size: fixedWidth ? fixedSize : configuredSize ?? DEFAULT_COLUMN_WIDTH,
      minSize: fixedWidth ? fixedSize : column.minSize ?? MIN_COLUMN_WIDTH,
      maxSize: fixedWidth ? fixedSize : column.maxSize ?? MAX_COLUMN_WIDTH,
    };
  }), [columns, sortableColumns]);

  const columnVisibility = useMemo<VisibilityState>(() => Object.fromEntries(
    columns.map(column => {
      const key = getTableColumnId(column);
      return [key, getTableColumnCanHide(column) ? !hiddenColumnKeys.includes(key) : true];
    }),
  ), [columns, hiddenColumnKeys]);

  // Adapt controlled sorting state. TanStack represents ascending as desc: false.
  const sortingState = useMemo<SortingState>(() => {
    if (!sorting) return [];
    return [{ id: sorting.key, desc: sorting.direction === 'desc' }];
  }, [sorting]);

  // Manage controlled column sizing.
  const normalizeColumnWidths = useCallback((next: ColumnSizingState): ColumnSizingState => Object.fromEntries(
    columns.flatMap(column => {
      if (column.enableResizing === false) return [];
      const key = getTableColumnId(column);
      const width = next[key];
      return Number.isFinite(width) ? [[key, clampColumnWidth(width)]] : [];
    }),
  ), [columns]);

  const handleColumnSizingChange = useCallback((updater: ColumnSizingState | ((current: ColumnSizingState) => ColumnSizingState)) => {
    if (!onColumnWidthsChange) return;
    const next = typeof updater === 'function' ? updater(columnWidths) : updater;
    onColumnWidthsChange(normalizeColumnWidths(next));
  }, [columnWidths, normalizeColumnWidths, onColumnWidthsChange]);

  // Expose application-level interactions.
  const toggleSort = useCallback((columnKey: string) => {
    if (!sortableColumns.includes(columnKey) || !onSortingChange) return;
    const ascending = sorting?.key === columnKey && sorting.direction === 'asc';
    onSortingChange({
      key: columnKey,
      direction: ascending ? 'desc' : 'asc',
    });
  }, [onSortingChange, sortableColumns, sorting]);

  const resizeColumnByStep = useCallback((
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

  // Build the TanStack model after adapting its controlled inputs.
  const table = useReactTable({
    data,
    columns: tanstackColumns,
    state: { sorting: sortingState, columnSizing: columnWidths, columnVisibility },
    manualSorting: true,
    autoResetPageIndex: false,
    enableMultiSort: false,
    columnResizeMode: 'onChange',
    onColumnSizingChange: handleColumnSizingChange,
    getCoreRowModel: getCoreRowModel(),
    getRowId: row => keyExtractor(row),
  });

  const leafColumns = table.getAllLeafColumns();
  // TanStack columns retain identity while their controlled sizing and visibility change.
  const resolvedColumnWidths = useMemo(() => Object.fromEntries(
    leafColumns.map(column => [column.id, column.getSize()]),
  // eslint-disable-next-line react-hooks/exhaustive-deps
  ), [leafColumns, columnWidths, columnVisibility]);

  return {
    headers: table.getHeaderGroups()[0].headers,
    rows: table.getRowModel().rows,
    isResizing: Boolean(table.getState().columnSizingInfo.isResizingColumn),
    resizeColumnByStep,
    resolvedColumnWidths,
    toggleSort,
    totalWidth: table.getTotalSize(),
  };
}
