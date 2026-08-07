export type SortDirection = 'asc' | 'desc';

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
