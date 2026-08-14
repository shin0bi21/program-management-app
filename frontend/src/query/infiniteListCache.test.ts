// @vitest-environment node

import { QueryClient, type InfiniteData } from '@tanstack/react-query';
import { describe, expect, it } from 'vitest';
import type { CursorPage } from '../common/types/pagination';
import { removeInfiniteListRow, replaceInfiniteListRow } from './infiniteListCache';

interface Row { id: string; name: string }

function infiniteData(...pages: Row[][]): InfiniteData<CursorPage<Row>> {
  return {
    pages: pages.map((rows, index) => ({ rows, nextCursor: index < pages.length - 1 ? `cursor-${index + 1}` : null })),
    pageParams: pages.map((_, index) => index ? `cursor-${index}` : null),
  };
}

describe('infinite list cache helpers', () => {
  it('replaces existing rows across matching list variants without inserting absent rows', () => {
    const queryClient = new QueryClient();
    const first = infiniteData([{ id: '1', name: 'Original' }], [{ id: '2', name: 'Second' }]);
    const second = infiniteData([{ id: '1', name: 'Filtered original' }]);
    const unrelated = infiniteData([{ id: '1', name: 'Unrelated' }]);
    queryClient.setQueryData(['examples', 'list', { status: 'all' }], first);
    queryClient.setQueryData(['examples', 'list', { status: 'active' }], second);
    queryClient.setQueryData(['other', 'list'], unrelated);

    const replacement = { id: '1', name: 'Updated' };
    replaceInfiniteListRow(queryClient, ['examples', 'list'], replacement);

    const firstResult = queryClient.getQueryData<InfiniteData<CursorPage<Row>>>(['examples', 'list', { status: 'all' }]);
    const secondResult = queryClient.getQueryData<InfiniteData<CursorPage<Row>>>(['examples', 'list', { status: 'active' }]);
    expect(firstResult?.pages[0].rows).toEqual([replacement]);
    expect(firstResult?.pages[1]).toBe(first.pages[1]);
    expect(secondResult?.pages[0].rows).toEqual([replacement]);
    expect(queryClient.getQueryData(['other', 'list'])).toBe(unrelated);

    replaceInfiniteListRow(queryClient, ['examples', 'list'], { id: 'missing', name: 'Missing' });
    expect(queryClient.getQueryData<InfiniteData<CursorPage<Row>>>(['examples', 'list', { status: 'all' }])
      ?.pages.flatMap(page => page.rows)).not.toContainEqual({ id: 'missing', name: 'Missing' });
  });

  it('removes a row from every matching filter and sort variant', () => {
    const queryClient = new QueryClient();
    queryClient.setQueryData(['examples', 'list', 'name'], infiniteData([
      { id: '1', name: 'First' },
      { id: '2', name: 'Second' },
    ]));
    queryClient.setQueryData(['examples', 'list', 'date'], infiniteData([{ id: '1', name: 'First' }]));

    removeInfiniteListRow(queryClient, ['examples', 'list'], '1');

    expect(queryClient.getQueryData<InfiniteData<CursorPage<Row>>>(['examples', 'list', 'name'])?.pages[0].rows)
      .toEqual([{ id: '2', name: 'Second' }]);
    expect(queryClient.getQueryData<InfiniteData<CursorPage<Row>>>(['examples', 'list', 'date'])?.pages[0].rows)
      .toEqual([]);
  });
});
