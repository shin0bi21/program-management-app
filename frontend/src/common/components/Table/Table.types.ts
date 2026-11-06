import type { ColumnDef, ColumnSizingState } from '@tanstack/react-table';

export type SortDirection = 'asc' | 'desc';

/** One server-supported ordering used by list queries and saved preferences. */
export interface ListSort<TKey extends string = string> {
  key: TKey;
  direction: SortDirection;
}

/**
 * Flat columns use unique, nonempty IDs shared by sorting, visibility, and saved widths.
 * Sortable IDs must match server sort keys; headers also label visibility and resize controls.
 * Column size/minSize/maxSize values are CSS pixels.
 */
export type TableColumnDef<T, TValue = unknown> = ColumnDef<T, TValue> & {
  columns?: never;
  header: string;
} & (
  | { id: string }
  | { accessorKey: string; id?: string }
);

/**
 * Resolves the stable ID of a flat column; rejects grouped or unidentified columns.
 * @returns The nonempty explicit ID, otherwise the accessor key without rewriting dotted paths.
 * @example getTableColumnId({ id: 'name', header: 'Name' }) returns 'name'.
 */
export function getTableColumnId<T>(column: ColumnDef<T, unknown>): string {
  if ('columns' in column && column.columns !== undefined) {
    throw new Error('Table columns must be flat; grouped columns are not supported');
  }
  if (column.id) return column.id;
  if ('accessorKey' in column && column.accessorKey) return String(column.accessorKey);
  throw new Error('Table columns must define a stable id or accessorKey');
}

/**
 * Returns literal header text for column controls; empty text is allowed.
 * Throws for a non-string header (or an invalid column ID while constructing that error).
 * @example getTableColumnHeader({ id: 'actions', header: '' }) returns ''.
 */
export function getTableColumnHeader<T>(column: ColumnDef<T, unknown>): string {
  if (typeof column.header === 'string') return column.header;
  throw new Error(`Table column ${getTableColumnId(column)} must define a string header`);
}

/**
 * Allows column hiding unless explicitly disabled by its owner.
 * @example getTableColumnCanHide({ id: 'actions', enableHiding: false }) returns false.
 */
export function getTableColumnCanHide<T>(column: ColumnDef<T, unknown>): boolean {
  return column.enableHiding !== false;
}

/** Controlled sort indicator and requested ordering; Table never reorders supplied records. */
export interface TableSorting {
  key: string;
  direction: SortDirection;
}

export interface TableProps<T> {
  ariaLabel: string;
  columns: TableColumnDef<T, unknown>[];
  /** Loaded records in display order, including all pages retained so far. */
  data: T[];

  // Loading and failure
  /** Initial empty load; headers remain mounted while the body shows a spinner. */
  loading?: boolean;
  /** Retains loaded rows and makes the body inert during a collection refresh. */
  refreshing?: boolean;
  /** @deprecated Prefer a domain-named unavailable state with an optional retry action. */
  error?: string;
  /** Supply only when no rows loaded; report refresh failures at the page with the same retry. */
  unavailable?: {
    title: string;
    message?: string;
    onRetry?: () => void;
  };
  emptyMessage?: string;

  // Selection
  /** Unique, stable record identity; selectedKey uses the same namespace. */
  keyExtractor: (item: T) => string;
  selectedKey?: string | null;
  scrollToSelected?: boolean;
  /** Reports the original record from row activation or navigation; the caller updates selectedKey. */
  onRowSelect?: (item: T) => void;

  // Sorting
  sorting?: TableSorting;
  /** Column IDs allowed to request server sorting, independent of ColumnDef.enableSorting. */
  sortableColumns?: readonly string[];
  /** Requests ascending first, then toggles directions; the caller updates sorting and data. */
  onSortingChange?: (sorting: TableSorting) => void;

  // Pagination
  hasNextPage?: boolean;
  loadingNextPage?: boolean;
  /** Requests another page near the scroll end; the caller owns fetching and loadingNextPage. */
  onLoadNextPage?: () => void;
  /** Keeps rows visible and pauses automatic loading while present; the caller owns retry recovery. */
  nextPageUnavailable?: { onRetry: () => void };

  // Column sizing and visibility
  /** Opt-in; also requires controlled columnWidths and onColumnWidthsChange. */
  enableColumnResizing?: boolean;
  /** Saved widths in CSS pixels by column ID; omitted entries use column defaults. */
  columnWidths?: ColumnSizingState;
  /** Receives a replacement width map, including retained hidden-column widths. */
  onColumnWidthsChange?: (widths: ColumnSizingState) => void;
  /** Column IDs to omit; enableHiding: false keeps a column visible regardless. */
  hiddenColumnKeys?: string[];

  // Layout
  maxHeight?: string;
}

export type TableNavigationKey = 'ArrowUp' | 'ArrowDown' | 'Home' | 'End';
