import { BadRequestError } from '../../src/errors';
import { sql } from '../shared/db';
import { cursorPage, decodeCursor, encodeCursor, paginateQuery } from '../../src/services/shared/cursorPagination';

const firstId = '00000000-0000-4000-8000-000000000001';
const secondId = '00000000-0000-4000-8000-000000000002';
const thirdId = '00000000-0000-4000-8000-000000000003';

describe('shared cursor pagination', () => {
  it('encodes and decodes text and numeric cursors', () => {
    for (const value of ['alpha', 2.5]) {
      const cursor = { value, id: firstId };

      expect(decodeCursor(encodeCursor(cursor))).toEqual(cursor);
    }
    expect(decodeCursor()).toBeNull();
  });

  it.each([
    'not-json',
    Buffer.from(`{"value":1e400,"id":"${firstId}"}`).toString('base64url'),
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

  it.each(['asc', 'desc'] as const)('pages numeric SQL rows in %s order without losing tied values', async direction => {
    const rowsQuery = sql<{ id: string; hours: number }[]>`
      SELECT * FROM (VALUES
        (${thirdId}::uuid, 10::double precision),
        (${secondId}::uuid, 2.5::double precision),
        (${firstId}::uuid, 2.5::double precision)
      ) fixture(id, hours)
    `;
    const options = { sortValue: sql`"row".hours`, direction, limit: 1 };
    const expectedIds = direction === 'asc' ? [firstId, secondId, thirdId] : [thirdId, secondId, firstId];
    const visibleIds: string[] = [];
    let cursor: string | undefined;

    for (const expectedId of expectedIds) {
      const page = await paginateQuery(rowsQuery, { ...options, cursor });

      expect(page.rows).toEqual([{ id: expectedId, hours: expectedId === thirdId ? 10 : 2.5 }]);
      visibleIds.push(...page.rows.map(row => row.id));
      cursor = page.nextCursor ?? undefined;
      expect(Boolean(cursor)).toBe(visibleIds.length < expectedIds.length);
    }

    expect(visibleIds).toEqual(expectedIds);
  });

  it('bounds rows and strips internal cursor values', async () => {
    const page = await paginateQuery(paginationRows(), {
      sortValue: sql`"row".name`, direction: 'asc', limit: 2,
    });

    expect(page.rows).toEqual([
      { id: firstId, name: 'alpha' },
      { id: secondId, name: 'alpha' },
    ]);
    expect(decodeCursor(page.nextCursor!)).toEqual({ value: 'alpha', id: secondId });
  });

  it('returns an empty terminal page when the filtered query has no rows', async () => {
    const rowsQuery = sql<{ id: string; name: string }[]>`SELECT * FROM (${paginationRows()}) filtered WHERE FALSE`;

    const page = await paginateQuery(rowsQuery, {
      sortValue: sql`"row".name`, direction: 'asc', limit: 2,
    });

    expect(page).toEqual({ rows: [], nextCursor: null });
  });
});

/**
 * Builds filtered SQL fixtures with equal sort values and an excluded row.
 * @returns An unexecuted query requiring no persistent fixture records.
 * @example await paginationRows() // two alpha rows and one beta row
 */
function paginationRows() {
  return sql<{ id: string; name: string }[]>`
    SELECT * FROM (VALUES
      (${thirdId}::uuid, 'beta'),
      (${secondId}::uuid, 'alpha'),
      (${firstId}::uuid, 'alpha'),
      ('00000000-0000-4000-8000-000000000004'::uuid, 'hidden')
    ) fixture(id, name)
    WHERE name <> 'hidden'
  `;
}
