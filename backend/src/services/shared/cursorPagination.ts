import { BadRequestError } from '../../errors';

export const DEFAULT_BATCH_SIZE = 50;
export const MAX_BATCH_SIZE = 50;

export interface ListCursor {
  value: string;
  id: string;
}

export function encodeCursor(cursor: ListCursor) {
  return Buffer.from(JSON.stringify(cursor), 'utf8').toString('base64url');
}

export function decodeCursor(cursor?: string): ListCursor | null {
  if (!cursor) return null;
  try {
    const parsed = JSON.parse(Buffer.from(cursor, 'base64url').toString('utf8')) as unknown;
    if (!parsed || typeof parsed !== 'object') throw new Error('Invalid cursor');
    const { value, id } = parsed as Partial<ListCursor>;
    if (typeof value !== 'string' || typeof id !== 'string'
      || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id)) {
      throw new Error('Invalid cursor');
    }
    return { value, id };
  } catch {
    throw new BadRequestError('Invalid pagination cursor');
  }
}

export function cursorPage<T extends { id: string; cursorValue: string }>(rows: T[], limit: number) {
  const hasMore = rows.length > limit;
  const visible = hasMore ? rows.slice(0, limit) : rows;
  const last = visible.at(-1);
  return {
    rows: visible.map(({ cursorValue: _cursorValue, ...row }) => row),
    nextCursor: hasMore && last ? encodeCursor({ value: last.cursorValue, id: last.id }) : null,
  };
}
