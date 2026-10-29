// @vitest-environment node

import { QueryClient, type InfiniteData } from '@tanstack/react-query';
import { describe, expect, it } from 'vitest';
import type { CursorPage } from './types';
import { getInfiniteListViewState, registerInfiniteListQuery, reconcileInfiniteListData, reconcileInfiniteListRead, removeInfiniteListRow, replaceInfiniteListRow } from './infiniteListCache';

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

for (const operation of ['replace', 'remove'] as const) {
 for (const cached of [false, true]) {
  it(`${operation} reconciles a pending list read (cached: ${cached})`, async () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const key = ['pending-rows', 'table'];
    const row = { id: 'row-1', name: 'Old' };
    const page = { pages: [{ rows: [row], nextCursor: null }], pageParams: [null] };
    if (cached) client.setQueryData(key, page);
    let resolve!: (value: CursorPage<Row>) => void;
    const pending = client.fetchQuery({
      queryKey: key,
      structuralSharing: (previous, incoming) => reconcileInfiniteListData<Row>(client, key, previous, incoming),
      queryFn: async () => ({
        ...page,
        pages: [await reconcileInfiniteListRead(client, key, () => new Promise<CursorPage<Row>>(done => { resolve = done; }))],
      }),
    });

    if (operation === 'replace') replaceInfiniteListRow(client, ['pending-rows', 'table'], { ...row, name: 'Saved' });
    else removeInfiniteListRow(client, ['pending-rows', 'table'], row.id);
    resolve(page.pages[0]);
    await pending;

    expect(client.getQueryState(key)?.fetchStatus).toBe('idle');

    expect(client.getQueryData(key)).toEqual({
      ...page, pages: [{ rows: operation === 'replace' ? [{ ...row, name: 'Saved' }] : [], nextCursor: null }],
    });
  });
}
}

describe('retained table view changes', () => {
  it('compares each exact query projection and ignores unchanged or unrelated fields', () => {
    const client = new QueryClient();
    const nameKey = ['projection-rows', 'table', 'name'];
    const idKey = ['projection-rows', 'table', 'id'];
    const row = { id: 'row-1', name: 'Original', note: 'Original note' };
    client.setQueryData(nameKey, infiniteData([row, { id: 'row-2', name: 'Second' }]));
    client.setQueryData(idKey, infiniteData([row, { id: 'row-2', name: 'Second' }]));
    registerInfiniteListQuery<Row>(client, nameKey, { ordering: { getValue: value => value.name, direction: 'asc' } });
    registerInfiniteListQuery<Row>(client, idKey, { ordering: { getValue: value => value.id, direction: 'asc' } });

    replaceInfiniteListRow(client, ['projection-rows', 'table'], { ...row, note: 'Updated note' });
    expect(getInfiniteListViewState(client, nameKey)).toBe('current');
    expect(getInfiniteListViewState(client, idKey)).toBe('current');

    const renamed = { ...row, name: 'Updated name' };
    replaceInfiniteListRow(client, ['projection-rows', 'table'], renamed);
    replaceInfiniteListRow(client, ['projection-rows', 'table'], renamed);

    expect(getInfiniteListViewState(client, nameKey)).toBe('retained');
    expect(getInfiniteListViewState(client, idKey)).toBe('current');
    client.removeQueries({ queryKey: nameKey, exact: true });
    expect(getInfiniteListViewState(client, nameKey)).toBe('current');
  });
});
