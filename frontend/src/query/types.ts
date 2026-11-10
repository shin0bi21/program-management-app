export interface CursorPage<T> {
  rows: T[];
  nextCursor: string | null;
}

export interface CursorRequest<TKey extends string = string> {
  key: TKey;
  direction: 'asc' | 'desc';
  cursor?: string;
}
