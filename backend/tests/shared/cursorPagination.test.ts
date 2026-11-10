import { BadRequestError } from '../../src/errors';
import { sql } from '../shared/db';
import { cursorPage, decodeCursor, encodeCursor, paginateQuery } from '../../src/services/shared/cursorPagination';

const firstId = '00000000-0000-4000-8000-000000000001';
const secondId = '00000000-0000-4000-8000-000000000002';

describe('shared cursor pagination', () => {
  it('encodes and decodes text, numeric, and null cursors', () => {
    for (const value of ['alpha', 2.5, null]) {
      const cursor = { value, id: firstId };

      expect(decodeCursor(encodeCursor(cursor))).toEqual(cursor);
    }
    expect(decodeCursor()).toBeNull();
  });

  it.each([
    'not-json',
    Buffer.from(`{"value":1e400,"id":"${firstId}"}`).toString('base64url'),
    Buffer.from(JSON.stringify({ value: 'alpha', id: 'invalid' })).toString('base64url'),
    Buffer.from(JSON.stringify({ id: firstId })).toString('base64url'),
    Buffer.from(JSON.stringify({ value: false, id: firstId })).toString('base64url'),
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
      SELECT ('00000000-0000-4000-8000-' || LPAD(number::text, 12, '0'))::uuid AS id,
        ((number - 1) / 3)::double precision + 0.5 AS hours
      FROM generate_series(1, 101) AS number
    `;
    const options = { sortValue: sql`"row".hours`, direction };
    const expected = Array.from({ length: 101 }, (_, index) => ({
      id: `00000000-0000-4000-8000-${String(index + 1).padStart(12, '0')}`,
      hours: Math.floor(index / 3) + 0.5,
    }));
    if (direction === 'desc') expected.reverse();
    const visibleIds: string[] = [];
    let cursor: string | undefined;

    for (let offset = 0; offset < expected.length; offset += 50) {
      const page = await paginateQuery(rowsQuery, { ...options, cursor });

      expect(page.rows).toEqual(expected.slice(offset, offset + 50));
      visibleIds.push(...page.rows.map(row => row.id));
      cursor = page.nextCursor ?? undefined;
      expect(Boolean(cursor)).toBe(visibleIds.length < expected.length);
    }

    expect(visibleIds).toEqual(expected.map(row => row.id));
  });

  describe.each([
    { name: 'text', expression: sql`'alpha'::text`, value: 'alpha' },
    { name: 'numeric', expression: sql`2.5::double precision`, value: 2.5 },
  ])('nullable $name sorting', ({ expression, value }) => {
    it.each(['asc', 'desc'] as const)('keeps nulls last across populated and null page boundaries in %s order', async direction => {
      const rowsQuery = sql<{ id: string; value: string | number | null }[]>`
        SELECT ('00000000-0000-4000-8000-' || LPAD(number::text, 12, '0'))::uuid AS id,
          CASE WHEN number <= 55 THEN ${expression} ELSE NULL END AS value
        FROM generate_series(1, 121) AS number
      `;
      const populated = Array.from({ length: 55 }, (_, index) => ({
        id: `00000000-0000-4000-8000-${String(index + 1).padStart(12, '0')}`, value,
      }));
      const missing = Array.from({ length: 66 }, (_, index) => ({
        id: `00000000-0000-4000-8000-${String(index + 56).padStart(12, '0')}`, value: null,
      }));
      if (direction === 'desc') {
        populated.reverse();
        missing.reverse();
      }
      const expected = [...populated, ...missing];
      const visibleIds: string[] = [];
      let cursor: string | undefined;

      for (let offset = 0; offset < expected.length; offset += 50) {
        const page = await paginateQuery(rowsQuery, { sortValue: sql`"row".value`, direction, cursor });

        expect(page.rows).toEqual(expected.slice(offset, offset + 50));
        visibleIds.push(...page.rows.map(row => row.id));
        cursor = page.nextCursor ?? undefined;
        expect(Boolean(cursor)).toBe(visibleIds.length < expected.length);
        if (cursor) expect(decodeCursor(cursor)?.value).toBe(offset === 0 ? value : null);
      }

      expect(visibleIds).toEqual(expected.map(row => row.id));
    });
  });

  it('bounds rows and strips internal cursor values', async () => {
    const page = await paginateQuery(paginationRows(), {
      sortValue: sql`"row".name`, direction: 'asc',
    });

    expect(page.rows).toEqual(Array.from({ length: 50 }, (_, index) => ({
      id: `00000000-0000-4000-8000-${String(index + 1).padStart(12, '0')}`,
      name: 'alpha',
    })));
    expect(decodeCursor(page.nextCursor!)).toEqual({
      value: 'alpha', id: '00000000-0000-4000-8000-000000000050',
    });
  });

  it('returns an empty terminal page when the filtered query has no rows', async () => {
    const rowsQuery = sql<{ id: string; name: string }[]>`SELECT * FROM (${paginationRows()}) filtered WHERE FALSE`;

    const page = await paginateQuery(rowsQuery, {
      sortValue: sql`"row".name`, direction: 'asc',
    });

    expect(page).toEqual({ rows: [], nextCursor: null });
  });
});

/**
 * Builds filtered SQL fixtures with equal sort values and an excluded row.
 * @returns An unexecuted query requiring no persistent fixture records.
 * @example await paginationRows() // 50 alpha rows and one beta row
 */
function paginationRows() {
  return sql<{ id: string; name: string }[]>`
    SELECT * FROM (
      SELECT ('00000000-0000-4000-8000-' || LPAD(number::text, 12, '0'))::uuid AS id,
        CASE
          WHEN number <= 50 THEN 'alpha'
          WHEN number = 51 THEN 'beta'
          ELSE 'hidden'
        END AS name
      FROM generate_series(1, 52) AS number
    ) fixture
    WHERE name <> 'hidden'
  `;
}
