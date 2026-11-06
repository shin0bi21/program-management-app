import { useEffect, useRef } from 'react';
import type { Row } from '@tanstack/react-table';
import TableRow from './TableRow';
import type { TableNavigationKey } from '../Table.types';
import UnavailableState from '../../UnavailableState/UnavailableState';
import LoadingSpinner from '../../LoadingSpinner/LoadingSpinner';

interface TableBodyProps<T> {
  rows: Row<T>[];
  visibleColumnCount: number;
  data: T[];
  loading: boolean;
  refreshing: boolean;
  unavailable?: {
    title: string;
    message?: string;
    onRetry?: () => void;
  };
  emptyMessage: string;
  keyExtractor: (item: T) => string;
  selectedKey?: string | null;
  tabbableIndex: number;
  onRowSelect?: (item: T) => void;
  onNavigate: (rowIndex: number, key: TableNavigationKey) => void;
}

/**
 * Displays every supplied row, or a loading, failure, or empty message in that order of precedence.
 * Refreshing retains the current content and makes the body inert until refreshing ends.
 * @param props.rows - Model rows in the same order as data so keyboard navigation indices match.
 * @example Two records render two rows; loading replaces both with a spinner spanning the visible columns.
 */
export default function TableBody<T>({
  rows,
  visibleColumnCount,
  data,
  loading,
  refreshing,
  unavailable,
  emptyMessage,
  keyExtractor,
  selectedKey,
  tabbableIndex,
  onRowSelect,
  onNavigate,
}: TableBodyProps<T>) {
  const bodyRef = useRef<HTMLTableSectionElement>(null);

  useEffect(() => {
    const body = bodyRef.current;
    if (!body) return;
    if (refreshing) body.setAttribute('inert', '');
    else body.removeAttribute('inert');
  }, [refreshing]);

  let content;
  if (loading) {
    content = (
      <tr className="table-loading-row">
        <td colSpan={visibleColumnCount} className="table-state-cell">
          <div className="table-loading-status" role="status" aria-label="Loading rows">
            <LoadingSpinner label="Loading rows…" />
          </div>
        </td>
      </tr>
    );
  } else if (unavailable) {
    content = (
      <tr className="table-error-row">
        <td colSpan={visibleColumnCount} className="table-state-cell">
          <UnavailableState {...unavailable} />
        </td>
      </tr>
    );
  } else if (data.length === 0) {
    content = (
      <tr className="table-empty-row">
        <td colSpan={visibleColumnCount} className="table-empty-cell">{emptyMessage}</td>
      </tr>
    );
  } else {
    content = rows.map((row, index) => {
      const item = row.original;
      const key = keyExtractor(item);
      return (
        <TableRow
          key={key}
          row={row}
          cells={row.getVisibleCells()}
          selected={selectedKey === key}
          tabbable={index === tabbableIndex}
          rowIndex={index}
          onSelect={onRowSelect}
          onNavigate={onNavigate}
        />
      );
    });
  }

  return <tbody ref={bodyRef} aria-busy={loading || refreshing || undefined}>{content}</tbody>;
}
