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

/**
 * Displays records in columns with optional row selection, sorting controls, and column resizing.
 * Sorting and pagination callbacks request data changes; this component does not fetch or sort records.
 * @param props.columns - Flat columns with stable IDs and string headers; grouped columns are rejected.
 * @param props.keyExtractor - Supplies unique, stable record keys for selection and row identity.
 * @example Two task records and Name/Status columns produce two rows with each task's name and status.
 */
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
  /**
   * Commits visible widths together with retained, resizable hidden-column widths.
   * @param nextWidths - Replacement visible-column widths in CSS pixels; omitted visible widths reset.
   * @example Resizing Name while Notes is hidden preserves the saved Notes width.
   */
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
  /**
   * Captures fractional rendered widths at gesture start without persisting them yet.
   * @returns Resizable-column widths in CSS pixels, retaining hidden preferences; undefined
   * without a controlled width callback or mounted table wrapper.
   * @example A 180.5px header remains 180.5px in the captured resize baseline.
   */
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
          <LoadingSpinner label="Updating rows…" />
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
