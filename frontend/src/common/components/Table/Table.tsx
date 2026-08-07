import { useRef } from 'react';
import TableBody from './components/TableBody';
import TableHeader from './components/TableHeader';
import useTableInfiniteScroll from './hooks/useTableInfiniteScroll';
import useTableModel from './hooks/useTableModel';
import useTableNavigation from './hooks/useTableNavigation';
import type { TableProps } from './Table.types';
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
}: TableProps<T>) {
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
    columns,
    sorting,
    onSortingChange,
    columnWidths,
    onColumnWidthsChange,
  });
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
        <TableHeader
          headers={headers}
          canResize={Boolean(onColumnWidthsChange)}
          onToggleSort={toggleSort}
          onNudgeWidth={nudgeColumnWidth}
        />
        <TableBody
          columns={columns}
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
          <span className="table-refresh-spinner" aria-hidden="true" />
          <span className="sr-only">Updating rows…</span>
        </div>
      )}
      <div ref={sentinelRef} className="table-scroll-sentinel" aria-hidden="true" />
      {loadingNextPage && <div className="table-next-page-status" role="status">Loading more…</div>}
    </div>
  );
}
