export type SortDirection = 'asc' | 'desc';
export type ColumnWidths<TKey extends string = string> = Partial<Record<TKey, number>>;

export interface ListSort<TKey extends string = string> {
  key: TKey;
  direction: SortDirection;
}

export interface CursorPage<T> {
  rows: T[];
  nextCursor: string | null;
}

export interface CursorRequest<TKey extends string = string> extends ListSort<TKey> {
  cursor?: string;
  limit?: number;
}
