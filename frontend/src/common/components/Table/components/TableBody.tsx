import { useEffect, useRef } from 'react';
import type { Row } from '@tanstack/react-table';
import TableRow from './TableRow';
import type { TableNavigationKey } from '../Table.types';
import UnavailableState from '../../UnavailableState/UnavailableState';

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
  columnWidths: Record<string, number>;
}

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
  columnWidths,
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
        <td colSpan={visibleColumnCount} className="table-state-cell">Loading...</td>
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
          selected={selectedKey === key}
          tabbable={index === tabbableIndex}
          rowIndex={index}
          onSelect={onRowSelect}
          onNavigate={onNavigate}
          columnWidths={columnWidths}
        />
      );
    });
  }

  return <tbody ref={bodyRef} aria-busy={refreshing || undefined}>{content}</tbody>;
}
