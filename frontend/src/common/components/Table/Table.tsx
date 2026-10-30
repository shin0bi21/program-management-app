import { useCallback, useLayoutEffect, useRef, useState } from 'react';
import UnavailableState from '../UnavailableState/UnavailableState';
import LoadingSpinner from '../LoadingSpinner/LoadingSpinner';
import TableBody from './components/TableBody';
import TableHeader from './components/TableHeader';
import useTableInfiniteScroll from './hooks/useTableInfiniteScroll';
import useTableModel from './hooks/useTableModel';
import useTableNavigation from './hooks/useTableNavigation';
import {
  getTableColumnId,
  type TableProps,
} from './Table.types';
import { clampColumnWidth } from './table.utils';
import './Table.css';

const EMPTY_KEYS: string[] = [];
const EMPTY_WIDTHS: Record<string, number> = {};

export default function Table<T>({
  ariaLabel,
  columns,
  data,
  loading = false,
  refreshing = false,
  error,
  unavailable,
  emptyMessage = 'No rows found',
  keyExtractor,
  maxHeight = 'calc(100dvh - 200px)',
  selectedKey,
  scrollToSelected = false,
  onRowSelect,
  sorting,
  sortableColumns = EMPTY_KEYS,
  onSortingChange,
  hasNextPage = false,
  loadingNextPage = false,
  onLoadNextPage,
  nextPageUnavailable,
  enableColumnResizing = false,
  columnWidths = EMPTY_WIDTHS,
  onColumnWidthsChange,
  hiddenColumnKeys = EMPTY_KEYS,
}: TableProps<T>) {
  const updateVisibleColumnWidths = useCallback((nextWidths: Record<string, number>) => {
    if (!onColumnWidthsChange) return;

    const hiddenWidths = Object.fromEntries(columns.flatMap((column) => {
      const key = getTableColumnId(column);
      if (column.enableResizing === false || !hiddenColumnKeys.includes(key)) return [];
      const width = columnWidths[key];
      return Number.isFinite(width) ? [[key, clampColumnWidth(width)]] : [];
    }));
    onColumnWidthsChange({ ...hiddenWidths, ...nextWidths });
  }, [columnWidths, columns, hiddenColumnKeys, onColumnWidthsChange]);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const [viewportWidth, setViewportWidth] = useState(0);
  useLayoutEffect(() => {
    const wrapper = wrapperRef.current;
    if (!wrapper || typeof ResizeObserver === 'undefined') return;

    // clientWidth rounds fractional CSS pixels and can create a scrollbar with no usable scroll range.
    const observer = new ResizeObserver(([entry]) => setViewportWidth(entry.contentRect.width));
    observer.observe(wrapper);
    return () => observer.disconnect();
  }, []);
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
    resize,
    rows,
    isResizing,
    resizeColumnByStep,
    resolvedColumnWidths,
    toggleSort,
    totalWidth,
  } = useTableModel({
    enableColumnResizing,
    viewportWidth,
    data,
    columns,
    hiddenColumnKeys,
    keyExtractor,
    sorting,
    sortableColumns,
    onSortingChange,
    columnWidths,
    onColumnWidthsChange: onColumnWidthsChange ? updateVisibleColumnWidths : undefined,
  });
  const lockRenderedColumnWidths = useCallback(() => {
    if (!onColumnWidthsChange) return undefined;
    const headerCells = wrapperRef.current?.querySelectorAll<HTMLTableCellElement>('thead th');
    if (!headerCells) return undefined;

    const preservedWidths = Object.fromEntries(columns.flatMap((column) => {
      if (column.enableResizing === false) return [];
      const key = getTableColumnId(column);
      const width = columnWidths[key];
      return Number.isFinite(width) ? [[key, clampColumnWidth(width)]] : [];
    }));
    const lockedWidths = {
      ...preservedWidths,
      ...Object.fromEntries(headers.flatMap((header, index) => {
        if (!header.column.getCanResize()) return [];
        const renderedWidth = headerCells[index]?.getBoundingClientRect().width;
        return [[
          header.column.id,
          clampColumnWidth(renderedWidth && renderedWidth > 0 ? renderedWidth : resolvedColumnWidths[header.column.id]),
        ]];
      })),
    };

    return lockedWidths;
  }, [columnWidths, columns, headers, onColumnWidthsChange, resolvedColumnWidths]);

  const sentinelRef = useTableInfiniteScroll({
    rootRef: wrapperRef,
    dataLength: data.length,
    hasNextPage: hasNextPage && !nextPageUnavailable,
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
        className={`table${loading ? ' table--loading' : ''}`}
        aria-label={ariaLabel}
        aria-busy={loading || refreshing || undefined}
        style={{ width: totalWidth, minWidth: totalWidth }}
      >
        <colgroup>
          {headers.map(header => (
            <col
              key={header.column.id}
              style={{ width: resolvedColumnWidths[header.column.id] }}
            />
          ))}
        </colgroup>
        <TableHeader
          headers={headers}
          onResizeStart={lockRenderedColumnWidths}
          onResizeDrag={(header, event) => {
            const widths = lockRenderedColumnWidths();
            if (widths && wrapperRef.current) resize.startResize(header, event, widths, wrapperRef.current);
          }}
          onToggleSort={toggleSort}
          onResizeByStep={resizeColumnByStep}
        />
        <TableBody
          rows={rows}
          visibleColumnCount={headers.length}
          data={data}
          loading={loading}
          refreshing={refreshing}
          unavailable={unavailable ?? (error ? {
            title: 'Content unavailable',
            message: error,
          } : undefined)}
          emptyMessage={emptyMessage}
          keyExtractor={keyExtractor}
          selectedKey={selectedKey}
          tabbableIndex={tabbableIndex}
          onRowSelect={onRowSelect}
          onNavigate={navigateRows}
        />
      </table>
      {resize.guide && <div className="table-resize-guide" aria-hidden="true" style={resize.guide} />}
      {refreshing && data.length > 0 && (
        <div className="table-refresh-status" role="status" aria-label="Updating rows">
          <LoadingSpinner />
          <span className="sr-only">Updating rows…</span>
        </div>
      )}
      <div ref={sentinelRef} className="table-scroll-sentinel" aria-hidden="true" />
      {nextPageUnavailable && !loadingNextPage && (
        <div className="table-next-page-status">
          <UnavailableState title="More rows unavailable" onRetry={nextPageUnavailable.onRetry} />
        </div>
      )}
      {loadingNextPage && <div className="table-next-page-status" role="status">Loading more…</div>}
    </div>
  );
}
