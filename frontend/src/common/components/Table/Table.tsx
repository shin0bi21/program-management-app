import { useCallback, useMemo, useRef } from 'react';
import LoadingSpinner from '../LoadingSpinner/LoadingSpinner';
import TableBody from './components/TableBody';
import TableHeader from './components/TableHeader';
import useTableInfiniteScroll from './hooks/useTableInfiniteScroll';
import useTableModel from './hooks/useTableModel';
import useTableNavigation from './hooks/useTableNavigation';
import type { TableProps } from './Table.types';
import { clampColumnWidth } from './table.utils';
import './Table.css';

export type { TableColumn } from './Table.types';

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
  hiddenColumnKeys = [],
}: TableProps<T>) {
  const visibleColumns = useMemo(
    () => columns.filter(column => column.hideable === false || column.resizable === false || !hiddenColumnKeys.includes(column.key)),
    [columns, hiddenColumnKeys],
  );
  const wrapperRef = useRef<HTMLDivElement>(null);
  const { navigateRows, tabbableIndex } = useTableNavigation({
    data,
    keyExtractor,
    selectedKey,
    scrollToSelected,
    onRowSelect,
    wrapperRef,
  });
  const {
    headers,
    isResizing,
    nudgeColumnWidth,
    resolvedColumnWidths,
    toggleSort,
    totalWidth,
  } = useTableModel({
    data,
    columns: visibleColumns,
    sorting,
    onSortingChange,
    columnWidths,
    onColumnWidthsChange,
  });
  const lockRenderedColumnWidths = useCallback(() => {
    if (!onColumnWidthsChange) return undefined;
    const headerCells = wrapperRef.current?.querySelectorAll<HTMLTableCellElement>('thead th');
    if (!headerCells) return undefined;

    const lockedWidths = Object.fromEntries(visibleColumns.flatMap((column, index) => {
      if (column.resizable === false) return [];
      const renderedWidth = headerCells[index]?.getBoundingClientRect().width;
      return [[
        column.key,
        clampColumnWidth(renderedWidth && renderedWidth > 0 ? renderedWidth : resolvedColumnWidths[column.key]),
      ]];
    }));

    onColumnWidthsChange(lockedWidths);
    return lockedWidths;
  }, [onColumnWidthsChange, resolvedColumnWidths, visibleColumns]);
  const sentinelRef = useTableInfiniteScroll({
    rootRef: wrapperRef,
    dataLength: data.length,
    hasNextPage,
    loadingNextPage,
    refreshing,
    onLoadNextPage,
  });

  return (
    <div
      ref={wrapperRef}
      className={`table-wrapper${isResizing ? ' table-wrapper--resizing' : ''}`}
      style={{ maxHeight }}
    >
      <table
        className="table"
        aria-label={ariaLabel}
        aria-busy={refreshing || undefined}
        style={{ width: '100%', minWidth: totalWidth }}
      >
        <colgroup>
          {visibleColumns.map(column => (
            <col
              key={column.key}
              style={{ width: resolvedColumnWidths[column.key] }}
            />
          ))}
        </colgroup>
        <TableHeader
          headers={headers}
          canResize={Boolean(onColumnWidthsChange)}
          onResizeStart={lockRenderedColumnWidths}
          onToggleSort={toggleSort}
          onNudgeWidth={nudgeColumnWidth}
        />
        <TableBody
          columns={visibleColumns}
          data={data}
          loading={loading}
          refreshing={refreshing}
          error={error}
          emptyMessage={emptyMessage}
          keyExtractor={keyExtractor}
          selectedKey={selectedKey}
          tabbableIndex={tabbableIndex}
          onRowSelect={onRowSelect}
          onNavigate={navigateRows}
          columnWidths={resolvedColumnWidths}
        />
      </table>
      {refreshing && data.length > 0 && (
        <div className="table-refresh-status" role="status" aria-label="Updating rows">
          <LoadingSpinner />
          <span className="sr-only">Updating rows…</span>
        </div>
      )}
      <div ref={sentinelRef} className="table-scroll-sentinel" aria-hidden="true" />
      {loadingNextPage && <div className="table-next-page-status" role="status">Loading more…</div>}
    </div>
  );
}
