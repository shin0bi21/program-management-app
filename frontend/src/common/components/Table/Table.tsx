import { useCallback, useEffect, useMemo, useRef } from 'react';
import { flexRender, getCoreRowModel, useReactTable, type ColumnDef, type SortingState } from '@tanstack/react-table';
import TableRow from './TableRow';
import type { TableColumn, TableNavigationKey, TableSorting } from './Table.types';
import './Table.css';

export type { TableColumn } from './Table.types';

interface TableProps<T> {
  ariaLabel: string;
  columns: TableColumn<T>[];
  data: T[];
  loading?: boolean;
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
}

export default function Table<T>({
  ariaLabel,
  columns,
  data,
  loading = false,
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
}: TableProps<T>) {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const sentinelRef = useRef<HTMLDivElement>(null);
  const lastScrolledSelectionRef = useRef<string | null>(null);
  const selectedIndex = selectedKey == null ? -1 : data.findIndex(item => keyExtractor(item) === selectedKey);
  const tabbableIndex = selectedIndex >= 0 ? selectedIndex : 0;

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
    meta: column,
  })), [columns]);
  const sortingState = useMemo<SortingState>(() => sorting
    ? [{ id: columns.find(column => column.sortKey === sorting.key)?.key ?? sorting.key, desc: sorting.direction === 'desc' }]
    : [], [columns, sorting]);
  const table = useReactTable({
    data,
    columns: tanstackColumns,
    state: { sorting: sortingState },
    manualSorting: true,
    enableMultiSort: false,
    getCoreRowModel: getCoreRowModel(),
    onSortingChange: updater => {
      const next = typeof updater === 'function' ? updater(sortingState) : updater;
      const selected = next[0];
      if (!selected) return;
      const column = columns.find(item => item.key === selected.id);
      if (column?.sortKey) onSortingChange?.({ key: column.sortKey, direction: selected.desc ? 'desc' : 'asc' });
    },
  });

  useEffect(() => {
    const sentinel = sentinelRef.current;
    const root = wrapperRef.current;
    if (!sentinel || !root || !hasNextPage || !onLoadNextPage) return;
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting && !loadingNextPage) onLoadNextPage();
    }, { root, rootMargin: '300px 0px' });
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [data.length, hasNextPage, loadingNextPage, onLoadNextPage]);

  return (
    <div ref={wrapperRef} className="table-wrapper" style={{ maxHeight }}>
      <table className="table" aria-label={ariaLabel}>
        <thead>
          <tr>
            {table.getHeaderGroups()[0].headers.map((header) => {
              const column = header.column.columnDef.meta as TableColumn<T>;
              const sortable = header.column.getCanSort();
              return (
              <th
                key={header.id}
                className={column.className}
                style={column.width ? { width: column.width } : undefined}
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
              </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
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
              />
            ))
          )}
        </tbody>
      </table>
      <div ref={sentinelRef} className="table-scroll-sentinel" aria-hidden="true" />
      {loadingNextPage && <div className="table-next-page-status" role="status">Loading more…</div>}
    </div>
  );
}
