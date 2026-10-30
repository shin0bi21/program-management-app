import { useCallback, useMemo } from 'react';
import useTableResize from './useTableResize';
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
  viewportWidth?: number;
  enableColumnResizing?: boolean;
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
  viewportWidth = 0,
  enableColumnResizing = false,
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
      return Number.isFinite(width) ? [[key, clampColumnWidth(width, column.minSize, column.maxSize)]] : [];
    }),
  ), [columns]);

  const getMinimumResizeWidth = useCallback((columnId: string, widths: ColumnSizingState) => {
    const column = columns.find(column => getTableColumnId(column) === columnId);
    const siblingWidth = columns.reduce((sum, sibling) => {
      const id = getTableColumnId(sibling);
      if (id === columnId || (getTableColumnCanHide(sibling) && hiddenColumnKeys.includes(id))) return sum;
      const width = sibling.enableResizing === false
        ? sibling.size ?? FIXED_COLUMN_WIDTH
        : widths[id] ?? sibling.size ?? DEFAULT_COLUMN_WIDTH;
      return sum + width;
    }, 0);

    return Math.max(column?.minSize ?? MIN_COLUMN_WIDTH, viewportWidth - siblingWidth);
  }, [columns, hiddenColumnKeys, viewportWidth]);

  const canResize = enableColumnResizing && Boolean(onColumnWidthsChange);
  const resize = useTableResize(next => onColumnWidthsChange?.(next), getMinimumResizeWidth, canResize);

  const handleColumnSizingChange = useCallback((updater: ColumnSizingState | ((current: ColumnSizingState) => ColumnSizingState)) => {
    if (!canResize || !onColumnWidthsChange || resize.commitResize()) return;
    const next = typeof updater === 'function' ? updater(columnWidths) : updater;
    onColumnWidthsChange(normalizeColumnWidths(next));
  }, [canResize, columnWidths, normalizeColumnWidths, onColumnWidthsChange, resize]);

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
    if (!canResize || !onColumnWidthsChange) return;
    const column = columns.find(column => getTableColumnId(column) === columnId);
    const delta = direction === 'ArrowLeft' ? -RESIZE_KEYBOARD_STEP : RESIZE_KEYBOARD_STEP;
    onColumnWidthsChange({
      ...columnWidths,
      ...lockedWidths,
      [columnId]: clampColumnWidth(currentWidth + delta, getMinimumResizeWidth(columnId, lockedWidths ?? columnWidths), column?.maxSize),
    });
  }, [canResize, columnWidths, columns, getMinimumResizeWidth, onColumnWidthsChange]);

  // Build the TanStack model after adapting its controlled inputs.
  const table = useReactTable({
    data,
    columns: tanstackColumns,
    state: { sorting: sortingState, columnSizing: columnWidths, columnVisibility, columnSizingInfo: resize.info },
    manualSorting: true,
    autoResetPageIndex: false,
    enableMultiSort: false,
    columnResizeMode: 'onEnd',
    enableColumnResizing: canResize,
    onColumnSizingInfoChange: resize.onSizingInfoChange,
    onColumnSizingChange: handleColumnSizingChange,
    getCoreRowModel: getCoreRowModel(),
    getRowId: row => keyExtractor(row),
  });

  const leafColumns = table.getAllLeafColumns();
  // TanStack columns retain identity while their controlled sizing and visibility change.
  const resolvedColumnWidths = useMemo(() => {
    const widths = Object.fromEntries(leafColumns.map(column => [column.id, column.getSize()]));
    const visible = leafColumns.filter(column => column.getIsVisible());
    const resizable = visible.filter(column => column.columnDef.enableResizing !== false);

    // Distribute spare viewport space only among data columns, within their limits.
    // Native fixed-table layout distributes it to action columns too and ignores maxSize.
    let spare = viewportWidth - visible.reduce((sum, column) => sum + widths[column.id], 0);
    let growing = resizable;
    while (spare > 0.5 && growing.length) {
      const weight = growing.reduce((sum, column) => sum + widths[column.id], 0);
      let distributed = 0;
      for (const column of growing) {
        const capacity = Math.max(0, Math.min(MAX_COLUMN_WIDTH, column.columnDef.maxSize ?? MAX_COLUMN_WIDTH) - widths[column.id]);
        const extra = Math.min(capacity, spare * widths[column.id] / weight);
        widths[column.id] += extra;
        distributed += extra;
      }
      spare -= distributed;
      growing = growing.filter(column => widths[column.id] < Math.min(MAX_COLUMN_WIDTH, column.columnDef.maxSize ?? MAX_COLUMN_WIDTH));
    }
    return widths;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [leafColumns, columnWidths, columnVisibility, viewportWidth]);

  const totalWidth = table.getVisibleLeafColumns().reduce((sum, column) => sum + resolvedColumnWidths[column.id], 0);

  return {
    resize,
    headers: table.getHeaderGroups()[0].headers,
    rows: table.getRowModel().rows,
    isResizing: Boolean(table.getState().columnSizingInfo.isResizingColumn),
    resizeColumnByStep,
    resolvedColumnWidths,
    toggleSort,
    totalWidth,
  };
}
