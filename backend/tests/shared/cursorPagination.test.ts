import { BadRequestError } from '../../src/errors';
import { cursorPage, decodeCursor, encodeCursor } from '../../src/services/shared/cursorPagination';

const firstId = '00000000-0000-4000-8000-000000000001';
const secondId = '00000000-0000-4000-8000-000000000002';

describe('shared cursor pagination', () => {
  it('encodes and decodes a cursor', () => {
    const cursor = { value: 'alpha', id: firstId };

    expect(decodeCursor(encodeCursor(cursor))).toEqual(cursor);
    expect(decodeCursor()).toBeNull();
  });

  it.each([
    'not-json',
    Buffer.from(JSON.stringify({ value: 1, id: firstId })).toString('base64url'),
    Buffer.from(JSON.stringify({ value: 'alpha', id: 'invalid' })).toString('base64url'),
  ])('rejects an invalid cursor', cursor => {
    expect(() => decodeCursor(cursor)).toThrow(BadRequestError);
  });

  it('strips cursor values and emits a cursor only when another row exists', () => {
    const rows = [
      { id: firstId, name: 'first', cursorValue: 'alpha' },
      { id: secondId, name: 'second', cursorValue: 'beta' },
    ];

    const firstPage = cursorPage(rows, 1);
    expect(firstPage.rows).toEqual([{ id: firstId, name: 'first' }]);
    expect(decodeCursor(firstPage.nextCursor!)).toEqual({ value: 'alpha', id: firstId });

    expect(cursorPage(rows.slice(1), 1)).toEqual({
      rows: [{ id: secondId, name: 'second' }],
      nextCursor: null,
    });
    expect(cursorPage([], 1)).toEqual({ rows: [], nextCursor: null });
  });
});
