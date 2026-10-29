import type { ColumnDef, ColumnSizingState } from '@tanstack/react-table';

export type SortDirection = 'asc' | 'desc';

export interface ListSort<TKey extends string = string> {
  key: TKey;
  direction: SortDirection;
}

export type TableColumnDef<T, TValue = unknown> = ColumnDef<T, TValue> & {
  columns?: never;
  header: string;
} & (
  | { id: string }
  | { accessorKey: string; id?: string }
);

export function getTableColumnId<T>(column: ColumnDef<T, unknown>): string {
  if ('columns' in column && column.columns !== undefined) {
    throw new Error('Table columns must be flat; grouped columns are not supported');
  }
  if (column.id) return column.id;
  if ('accessorKey' in column && column.accessorKey) return String(column.accessorKey);
  throw new Error('Table columns must define a stable id or accessorKey');
}

export function getTableColumnHeader<T>(column: ColumnDef<T, unknown>): string {
  if (typeof column.header === 'string') return column.header;
  throw new Error(`Table column ${getTableColumnId(column)} must define a string header`);
}

export function getTableColumnCanHide<T>(column: ColumnDef<T, unknown>): boolean {
  return column.enableHiding !== false;
}

export interface TableSorting {
  key: string;
  direction: SortDirection;
}

export interface TableProps<T> {
  ariaLabel: string;
  columns: TableColumnDef<T, unknown>[];
  data: T[];

  /* === Loading / error states === */
  loading?: boolean;
  refreshing?: boolean;
  /** @deprecated Prefer a domain-named unavailable state with an optional retry action. */
  error?: string;
  unavailable?: {
    title: string;
    message?: string;
    onRetry?: () => void;
  };
  emptyMessage?: string;

  /* === Selection === */
  keyExtractor: (item: T) => string;
  selectedKey?: string | null;
  scrollToSelected?: boolean;
  onRowSelect?: (item: T) => void;

  /* === Sorting === */
  sorting?: TableSorting;
  sortableColumns?: readonly string[];
  onSortingChange?: (sorting: TableSorting) => void;

  /* === Pagination === */
  hasNextPage?: boolean;
  loadingNextPage?: boolean;
  onLoadNextPage?: () => void;
  nextPageUnavailable?: { onRetry: () => void };

  /* === Column sizing / visibility === */
  columnWidths?: ColumnSizingState;
  onColumnWidthsChange?: (widths: ColumnSizingState) => void;
  hiddenColumnKeys?: string[];

  /* === Layout === */
  maxHeight?: string;
}

export type TableNavigationKey = 'ArrowUp' | 'ArrowDown' | 'Home' | 'End';
