import { useCallback, useEffect, useMemo, useRef } from 'react';
import { flexRender, getCoreRowModel, useReactTable, type ColumnDef, type ColumnSizingState, type SortingState } from '@tanstack/react-table';
import TableRow from './TableRow';
import type { TableColumn, TableNavigationKey, TableSorting } from './Table.types';
import './Table.css';

export type { TableColumn } from './Table.types';

interface TableProps<T> {
  ariaLabel: string;
  columns: TableColumn<T>[];
  data: T[];
  loading?: boolean;
  refreshing?: boolean;
  error?: string;
  emptyMessage?: string;
  keyExtractor: (item: T) => string;
  maxHeight?: string;
  selectedKey?: string | null;
  scrollToSelected?: boolean;
  onRowSelect?: (item: T) => void;
  sorting?: TableSorting;
  onSortingChange?: (sorting: TableSorting) => void;
  hasNextPage?: boolean;
  loadingNextPage?: boolean;
  onLoadNextPage?: () => void;
  columnWidths?: ColumnSizingState;
  onColumnWidthsChange?: (widths: ColumnSizingState) => void;
}

export default function Table<T>({
  ariaLabel,
  columns,
  data,
  loading = false,
  refreshing = false,
  error,
  emptyMessage = 'No rows found',
  keyExtractor,
  maxHeight = 'calc(100dvh - 200px)',
  selectedKey,
  scrollToSelected = false,
  onRowSelect,
  sorting,
  onSortingChange,
  hasNextPage = false,
  loadingNextPage = false,
  onLoadNextPage,
  columnWidths = {},
  onColumnWidthsChange,
}: TableProps<T>) {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const bodyRef = useRef<HTMLTableSectionElement>(null);
  const sentinelRef = useRef<HTMLDivElement>(null);
  const lastScrolledSelectionRef = useRef<string | null>(null);
  const selectedIndex = selectedKey == null ? -1 : data.findIndex(item => keyExtractor(item) === selectedKey);
  const tabbableIndex = selectedIndex >= 0 ? selectedIndex : 0;

  useEffect(() => {
    const body = bodyRef.current;
    if (!body) return;
    if (refreshing) body.setAttribute('inert', '');
    else body.removeAttribute('inert');
  }, [refreshing]);

  useEffect(() => {
    if (!scrollToSelected || selectedKey == null) {
      lastScrolledSelectionRef.current = null;
      return;
    }
    if (selectedIndex < 0) {
      if (data.length === 0) lastScrolledSelectionRef.current = null;
      return;
    }
    if (lastScrolledSelectionRef.current === selectedKey) return;
    wrapperRef.current
      ?.querySelector<HTMLTableRowElement>('.table-row--selected')
      ?.scrollIntoView?.({ block: 'nearest' });
    lastScrolledSelectionRef.current = selectedKey;
  }, [data, scrollToSelected, selectedIndex, selectedKey]);

  const navigateRows = useCallback((currentIndex: number, key: TableNavigationKey) => {
    if (data.length === 0) return;

    let nextIndex = currentIndex;
    if (key === 'ArrowUp') nextIndex = Math.max(0, currentIndex - 1);
    if (key === 'ArrowDown') nextIndex = Math.min(data.length - 1, currentIndex + 1);
    if (key === 'Home') nextIndex = 0;
    if (key === 'End') nextIndex = data.length - 1;

    onRowSelect?.(data[nextIndex]);
    wrapperRef.current
      ?.querySelector<HTMLTableRowElement>(`tr[data-table-row-index="${nextIndex}"]`)
      ?.focus();
  }, [data, onRowSelect]);

  const tanstackColumns = useMemo<ColumnDef<T>[]>(() => columns.map(column => ({
    id: column.key,
    accessorFn: row => row,
    header: column.header,
    cell: context => column.render(context.row.original),
    enableSorting: Boolean(column.sortKey),
    enableResizing: column.resizable !== false,
    size: column.resizable === false ? column.width ?? 40 : column.width ?? 150,
    minSize: column.resizable === false ? column.width ?? 40 : 100,
    maxSize: column.resizable === false ? column.width ?? 40 : 500,
    meta: column,
  })), [columns]);
  const sortingState = useMemo<SortingState>(() => sorting
    ? [{ id: columns.find(column => column.sortKey === sorting.key)?.key ?? sorting.key, desc: sorting.direction === 'desc' }]
    : [], [columns, sorting]);
  const normalizeColumnWidths = useCallback((next: ColumnSizingState) => Object.fromEntries(
    columns.flatMap(column => {
      if (column.resizable === false) return [];
      const width = next[column.key];
      return Number.isFinite(width)
        ? [[column.key, Math.min(500, Math.max(100, Math.round(width)))]]
        : [];
    }),
  ), [columns]);
  const table = useReactTable({
    data,
    columns: tanstackColumns,
    state: { sorting: sortingState, columnSizing: columnWidths },
    manualSorting: true,
    enableMultiSort: false,
    columnResizeMode: 'onChange',
    onColumnSizingChange: updater => {
      if (!onColumnWidthsChange) return;
      const next = typeof updater === 'function' ? updater(columnWidths) : updater;
      onColumnWidthsChange(normalizeColumnWidths(next));
    },
    getCoreRowModel: getCoreRowModel(),
    onSortingChange: updater => {
      const next = typeof updater === 'function' ? updater(sortingState) : updater;
      const selected = next[0];
      if (!selected) return;
      const column = columns.find(item => item.key === selected.id);
      if (column?.sortKey) onSortingChange?.({ key: column.sortKey, direction: selected.desc ? 'desc' : 'asc' });
    },
  });
  const resolvedColumnWidths = Object.fromEntries(
    table.getAllLeafColumns().map(column => [column.id, column.getSize()]),
  );
  const resizing = Boolean(table.getState().columnSizingInfo.isResizingColumn);

  useEffect(() => {
    const sentinel = sentinelRef.current;
    const root = wrapperRef.current;
    if (!sentinel || !root || !hasNextPage || !onLoadNextPage || refreshing) return;
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting && !loadingNextPage) onLoadNextPage();
    }, { root, rootMargin: '300px 0px' });
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [data.length, hasNextPage, loadingNextPage, onLoadNextPage, refreshing]);

  return (
    <div ref={wrapperRef} className={`table-wrapper${resizing ? ' table-wrapper--resizing' : ''}`} style={{ maxHeight }}>
      <table className="table" aria-label={ariaLabel} aria-busy={refreshing || undefined} style={{ width: '100%', minWidth: table.getTotalSize() }}>
        <thead>
          <tr>
            {table.getHeaderGroups()[0].headers.map((header) => {
              const column = header.column.columnDef.meta as TableColumn<T>;
              const sortable = header.column.getCanSort();
              return (
              <th
                key={header.id}
                className={column.className}
                style={{ width: header.getSize() }}
                aria-sort={header.column.getIsSorted() === 'asc' ? 'ascending' : header.column.getIsSorted() === 'desc' ? 'descending' : undefined}
              >
                {sortable ? (
                  <button type="button" className="table-sort-trigger" onClick={() => {
                    if (!column.sortKey || !onSortingChange) return;
                    onSortingChange({
                      key: column.sortKey,
                      direction: sorting?.key === column.sortKey && sorting.direction === 'asc' ? 'desc' : 'asc',
                    });
                  }}>
                    {flexRender(header.column.columnDef.header, header.getContext())}
                    <span aria-hidden="true" className="table-sort-indicator" data-direction={header.column.getIsSorted() || 'none'} />
                  </button>
                ) : flexRender(header.column.columnDef.header, header.getContext())}
                {header.column.getCanResize() && onColumnWidthsChange && (
                  <button
                    type="button"
                    className={`table-resize-handle${header.column.getIsResizing() ? ' table-resize-handle--active' : ''}`}
                    aria-label={`Resize ${String(column.header)} column`}
                    onMouseDown={header.getResizeHandler()}
                    onTouchStart={header.getResizeHandler()}
                    onDoubleClick={() => header.column.resetSize()}
                    onKeyDown={(event) => {
                      if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
                      event.preventDefault();
                      const delta = event.key === 'ArrowLeft' ? -10 : 10;
                      onColumnWidthsChange({
                        ...columnWidths,
                        [header.column.id]: Math.min(500, Math.max(100, header.getSize() + delta)),
                      });
                    }}
                  />
                )}
              </th>
              );
            })}
          </tr>
        </thead>
        <tbody ref={bodyRef} aria-busy={refreshing || undefined}>
          {loading ? (
            <tr className="table-loading-row">
              <td colSpan={columns.length} className="table-state-cell">Loading...</td>
            </tr>
          ) : error ? (
            <tr className="table-error-row">
              <td colSpan={columns.length} className="table-state-cell table-error-cell">{error}</td>
            </tr>
          ) : data.length === 0 ? (
            <tr className="table-empty-row">
              <td colSpan={columns.length} className="table-empty-cell">{emptyMessage}</td>
            </tr>
          ) : (
            data.map((item, index) => (
              <TableRow
                key={keyExtractor(item)}
                item={item}
                columns={columns}
                selected={selectedKey === keyExtractor(item)}
                tabbable={index === tabbableIndex}
                rowIndex={index}
                onSelect={onRowSelect}
                onNavigate={navigateRows}
                columnWidths={resolvedColumnWidths}
              />
            ))
          )}
        </tbody>
      </table>
      {refreshing && data.length > 0 && (
        <div className="table-refresh-status" role="status" aria-label="Updating rows">
          <span className="table-refresh-spinner" aria-hidden="true" />
          <span className="sr-only">Updating rows…</span>
        </div>
      )}
      <div ref={sentinelRef} className="table-scroll-sentinel" aria-hidden="true" />
      {loadingNextPage && <div className="table-next-page-status" role="status">Loading more…</div>}
    </div>
  );
}
