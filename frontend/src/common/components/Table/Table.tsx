import { useCallback, useEffect, useRef } from 'react';
import TableRow from './TableRow';
import type { TableColumn, TableNavigationKey } from './Table.types';
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
}: TableProps<T>) {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const selectedIndex = selectedKey == null ? -1 : data.findIndex(item => keyExtractor(item) === selectedKey);
  const tabbableIndex = selectedIndex >= 0 ? selectedIndex : 0;

  useEffect(() => {
    if (!scrollToSelected || selectedIndex < 0) return;
    wrapperRef.current
      ?.querySelector<HTMLTableRowElement>('.table-row--selected')
      ?.scrollIntoView?.({ block: 'nearest' });
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

  return (
    <div ref={wrapperRef} className="table-wrapper" style={{ maxHeight }}>
      <table className="table" aria-label={ariaLabel}>
        <thead>
          <tr>
            {columns.map((column) => (
              <th
                key={column.key}
                className={column.className}
                style={column.width ? { width: column.width } : undefined}
              >
                {column.header}
              </th>
            ))}
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
    </div>
  );
}
