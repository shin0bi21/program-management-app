import type { ReactNode } from 'react';
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

export type TableNavigationKey = 'ArrowUp' | 'ArrowDown' | 'Home' | 'End';
