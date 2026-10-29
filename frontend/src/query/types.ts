export const TABLE_PAGE_SIZE = 50;

export interface CursorPage<T> {
  rows: T[];
  nextCursor: string | null;
}

export interface CursorRequest<TKey extends string = string> {
  key: TKey;
  direction: 'asc' | 'desc';
  cursor?: string;
  limit?: number;
}
