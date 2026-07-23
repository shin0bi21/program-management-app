import type { ReactNode } from 'react';

export interface TableColumn<T> {
  key: string;
  header: string;
  render: (item: T) => ReactNode;
  width?: string;
  className?: string;
}

export type TableNavigationKey = 'ArrowUp' | 'ArrowDown' | 'Home' | 'End';
