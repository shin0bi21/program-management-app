import type { ReactNode } from 'react';
import type { ColumnSizingState } from '@tanstack/react-table';
import type { SortDirection } from '../../types/pagination';

export interface TableColumn<T> {
  key: string;
  header: string;
  render: (item: T) => ReactNode;
  width?: number;
  className?: string;
  sortKey?: string;
  resizable?: boolean;
}

export interface TableSorting {
  key: string;
  direction: SortDirection;
}

export interface TableProps<T> {
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

export type TableNavigationKey = 'ArrowUp' | 'ArrowDown' | 'Home' | 'End';
