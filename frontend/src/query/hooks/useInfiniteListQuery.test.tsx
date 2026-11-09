import { removeInfiniteListRow, replaceInfiniteListRow } from '../infiniteListCache';
import { createTestQueryClient, createQueryClientWrapper } from '../../tests/queryClientTestUtils';
import { onlineManager } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import useInfiniteListQuery from './useInfiniteListQuery';

interface Row { id: string; name: string }

/**
 * Holds a test response until its request should complete.
 * @returns A promise and the function that supplies its eventual value.
 * @example response.resolve(page) // completes response.promise with page
 */
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>(next => { resolve = next; });
  return { promise, resolve };
}

describe('useInfiniteListQuery', () => {
  it('requests and appends the next cursor page', async () => {
    const nextPage = deferred<{ rows: Row[]; nextCursor: null }>();
    const queryFn = vi.fn(({ pageParam }: { pageParam: string | null }) => pageParam === null
      ? Promise.resolve({ rows: [{ id: '1', name: 'First' }], nextCursor: 'cursor-2' })
      : nextPage.promise);
    const client = createTestQueryClient();
    const wrapper = createQueryClientWrapper(client);
    const { result } = renderHook(() => useInfiniteListQuery<Row>({
      queryKey: ['rows'], queryFn, errorMessage: 'Could not load rows',
    }), { wrapper });

    await waitFor(() => expect(result.current.rows).toEqual([{ id: '1', name: 'First' }]));
    expect(result.current.hasNextPage).toBe(true);
    act(() => result.current.loadNextPage());

    await waitFor(() => expect(result.current.loadingNextPage).toBe(true));
    expect(result.current.refreshing).toBe(false);

    act(() => nextPage.resolve({ rows: [{ id: '2', name: 'Second' }], nextCursor: null }));

    await waitFor(() => expect(result.current.rows).toEqual([
      { id: '1', name: 'First' },
      { id: '2', name: 'Second' },
    ]));
    expect(queryFn).toHaveBeenLastCalledWith(expect.objectContaining({ pageParam: 'cursor-2' }));
    expect(result.current.hasNextPage).toBe(false);
  });

  it('deduplicates stable row IDs across cursor page boundaries', async () => {
    const queryFn = vi.fn(({ pageParam }: { pageParam: string | null }) => Promise.resolve(
      pageParam === null
        ? { rows: [{ id: '1', name: 'Original' }], nextCursor: 'cursor-2' }
        : { rows: [{ id: '1', name: 'Updated' }, { id: '2', name: 'Second' }], nextCursor: null },
    ));
    const client = createTestQueryClient();
    const wrapper = createQueryClientWrapper(client);
    const { result } = renderHook(() => useInfiniteListQuery<Row>({
      queryKey: ['deduplicated-rows'], queryFn, errorMessage: 'Could not load rows',
    }), { wrapper });

    await waitFor(() => expect(result.current.rows).toHaveLength(1));
    act(() => result.current.loadNextPage());
    await waitFor(() => expect(result.current.rows).toEqual([
      { id: '1', name: 'Updated' },
      { id: '2', name: 'Second' },
    ]));
  });

  it('discards the previous list when the query key changes and the current list on unmount', async () => {
    const first = deferred<{ rows: Row[]; nextCursor: null }>();
    const second = deferred<{ rows: Row[]; nextCursor: null }>();
    const client = createTestQueryClient();
    const wrapper = createQueryClientWrapper(client);
    const { result, rerender, unmount } = renderHook(
      ({ order }) => useInfiniteListQuery<Row>({
        queryKey: ['rows', order],
        queryFn: () => order === 'first' ? first.promise : second.promise,
        errorMessage: 'Could not load rows',
      }),
      { initialProps: { order: 'first' }, wrapper },
    );

    act(() => first.resolve({ rows: [{ id: '1', name: 'First' }], nextCursor: null }));
    await waitFor(() => expect(result.current.rows).toEqual([{ id: '1', name: 'First' }]));

    rerender({ order: 'second' });
    expect(result.current.loading).toBe(true);
    expect(result.current.rows).toEqual([]);
    await waitFor(() => expect(client.getQueryState(['rows', 'first'])).toBeUndefined());

    act(() => second.resolve({ rows: [{ id: '2', name: 'Second' }], nextCursor: null }));
    await waitFor(() => expect(result.current.rows).toEqual([{ id: '2', name: 'Second' }]));
    expect(result.current.refreshing).toBe(false);

    unmount();
    await waitFor(() => expect(client.getQueryState(['rows', 'second'])).toBeUndefined());
  });

  it('maps a failed request and retries successfully', async () => {
    const queryFn = vi.fn()
      .mockRejectedValueOnce(new Error('Request failed'))
      .mockResolvedValueOnce({ rows: [{ id: '1', name: 'Recovered' }], nextCursor: null });
    const client = createTestQueryClient();
    const { result } = renderHook(() => useInfiniteListQuery<Row>({
      queryKey: ['failed-rows'], queryFn, errorMessage: 'Could not load rows',
    }), { wrapper: createQueryClientWrapper(client) });

    await waitFor(() => expect(result.current.error).toBe('Request failed'));
    act(() => result.current.retry());

    await waitFor(() => expect(result.current.rows).toEqual([{ id: '1', name: 'Recovered' }]));
    expect(result.current.error).toBe('');
    expect(queryFn).toHaveBeenCalledTimes(2);
  });
  it('keeps collection refresh failures separate and blocks automatic pagination', async () => {
    const queryFn = vi.fn()
      .mockResolvedValueOnce({ rows: [{ id: '1', name: 'First' }], nextCursor: 'next' })
      .mockRejectedValueOnce(new Error('Refresh failed'));
    const client = createTestQueryClient();
    const { result } = renderHook(() => useInfiniteListQuery<Row>({
      queryKey: ['refresh-failure'], queryFn, errorMessage: 'Could not load rows',
    }), { wrapper: createQueryClientWrapper(client) });

    await waitFor(() => expect(result.current.rows).toHaveLength(1));
    act(() => result.current.retry());
    await waitFor(() => expect(result.current.error).toBe('Refresh failed'));
    expect(result.current.nextPageError).toBe('');
    expect(result.current.hasNextPage).toBe(false);
    act(() => result.current.loadNextPage());
    expect(queryFn).toHaveBeenCalledTimes(2);
  });

  it('does not paginate a disabled cached collection', async () => {
    const queryFn = vi.fn().mockResolvedValue({ rows: [{ id: '1', name: 'First' }], nextCursor: 'next' });
    const client = createTestQueryClient();
    const { result, rerender } = renderHook(({ enabled }) => useInfiniteListQuery<Row>({
      queryKey: ['disabled-pagination'], queryFn, errorMessage: 'Could not load rows', enabled,
    }), { initialProps: { enabled: true }, wrapper: createQueryClientWrapper(client) });

    await waitFor(() => expect(result.current.rows).toHaveLength(1));
    rerender({ enabled: false });
    expect(result.current.hasNextPage).toBe(false);
    act(() => { result.current.loadNextPage(); result.current.retryNextPage(); });
    expect(queryFn).toHaveBeenCalledOnce();
  });

  it('retains stable rows and pauses automatic pagination after repeated failures until explicit recovery', async () => {
    const queryFn = vi.fn()
      .mockResolvedValueOnce({ rows: [{ id: '1', name: 'First' }], nextCursor: 'next' })
      .mockRejectedValueOnce(new Error('More failed'))
      .mockRejectedValueOnce(new Error('More failed again'))
      .mockResolvedValueOnce({ rows: [{ id: '2', name: 'Second' }], nextCursor: 'third' });
    const client = createTestQueryClient();
    const { result, rerender } = renderHook(() => useInfiniteListQuery<Row>({
      queryKey: ['pagination-failure'], queryFn, errorMessage: 'Could not load rows',
    }), { wrapper: createQueryClientWrapper(client) });

    await waitFor(() => expect(result.current.rows).toHaveLength(1));
    const originalRows = result.current.rows;
    rerender();
    expect(result.current.rows).toBe(originalRows);

    act(() => result.current.loadNextPage());
    await waitFor(() => expect(result.current.nextPageError).toBe('More failed'));
    expect(result.current.error).toBe('');
    expect(result.current.rows).toBe(originalRows);
    expect(result.current.hasNextPage).toBe(false);

    act(() => result.current.loadNextPage());
    expect(queryFn).toHaveBeenCalledTimes(2);
    act(() => result.current.retryNextPage());
    await waitFor(() => expect(result.current.nextPageError).toBe('More failed again'));
    act(() => result.current.loadNextPage());
    expect(queryFn).toHaveBeenCalledTimes(3);

    act(() => result.current.retryNextPage());
    await waitFor(() => expect(result.current.rows).toHaveLength(2));
    expect(result.current.rows[0]).toBe(originalRows[0]);
    expect(result.current.nextPageError).toBe('');
    expect(result.current.hasNextPage).toBe(true);
    expect(queryFn).toHaveBeenLastCalledWith(expect.objectContaining({ pageParam: 'next' }));
  });

});

for (const operation of ['replace', 'remove'] as const) {
  for (const mode of ['next-page', 'refetch'] as const) {
    it(`preserves a page-one ${operation} while ${mode} waits for page two`, async () => {
      const first = { id: 'row-1', name: 'Old' };
      const second = { id: 'row-2', name: 'Second' };
      const firstPage: { rows: typeof first[]; nextCursor: string | null } = { rows: [first], nextCursor: 'page-2' };
      const secondPage = { rows: [second], nextCursor: null };
      const pending = deferred<typeof secondPage>();
      const queryFn = vi.fn(({ pageParam }: { pageParam: string | null }) => Promise.resolve(pageParam ? secondPage : firstPage));
      const client = createTestQueryClient();
      const key = ['concurrent-list', mode, operation];
      const { result } = renderHook(() => useInfiniteListQuery<Row>({
        queryKey: key, queryFn, errorMessage: 'Could not load rows',
      }), { wrapper: createQueryClientWrapper(client) });
      await waitFor(() => expect(result.current.rows).toEqual([first]));
      if (mode === 'refetch') {
        act(() => result.current.loadNextPage());
        await waitFor(() => expect(result.current.rows).toEqual([first, second]));
      }
      queryFn.mockImplementation(({ pageParam }) => pageParam ? pending.promise : Promise.resolve(firstPage));
      queryFn.mockClear();

      act(() => mode === 'next-page' ? result.current.loadNextPage() : result.current.retry());
      await waitFor(() => expect(queryFn).toHaveBeenCalledWith(expect.objectContaining({ pageParam: 'page-2' })));
      act(() => {
        if (operation === 'replace') replaceInfiniteListRow(client, key, { ...first, name: 'Saved' });
        else removeInfiniteListRow(client, key, first.id);
      });
      act(() => pending.resolve(secondPage));

      await waitFor(() => expect(result.current.loadingNextPage || result.current.refreshing).toBe(false));
      expect(result.current.rows).toEqual(operation === 'replace' ? [{ ...first, name: 'Saved' }, second] : [second]);
      expect(result.current.error).toBe('');

      queryFn.mockImplementation(({ pageParam }) => Promise.resolve(pageParam ? secondPage : {
        rows: [{ ...first, name: 'Newest server value' }], nextCursor: 'page-2',
      }));
      act(() => result.current.retry());
      await waitFor(() => expect(result.current.rows[0]?.name).toBe('Newest server value'));
    });
  }
}

it('preserves a saved row while next-page loading is paused offline before the request starts', async () => {
  const first = { id: 'row-1', name: 'Old' };
  const second = { id: 'row-2', name: 'Second' };
  const client = createTestQueryClient();
  const key = ['paused-list'];
  const queryFn = vi.fn(({ pageParam }: { pageParam: string | null }) => Promise.resolve(pageParam
    ? { rows: [second], nextCursor: null }
    : { rows: [first], nextCursor: 'next' }));
  const { result } = renderHook(() => useInfiniteListQuery<Row>({ queryKey: key, queryFn, errorMessage: 'Unavailable' }), {
    wrapper: createQueryClientWrapper(client),
  });
  await waitFor(() => expect(result.current.rows).toEqual([first]));

  try {
    onlineManager.setOnline(false);
    act(() => result.current.loadNextPage());
    await waitFor(() => expect(client.getQueryState(key)?.fetchStatus).toBe('paused'));
    act(() => replaceInfiniteListRow(client, key, { ...first, name: 'Saved' }));
    onlineManager.setOnline(true);

    await waitFor(() => expect(result.current.rows).toHaveLength(2));
    expect(result.current.rows).toEqual([{ ...first, name: 'Saved' }, second]);
  } finally {
    onlineManager.setOnline(true);
  }
});

describe('out-of-order refresh notice', () => {
  const first = { id: 'row-1', name: 'Alpha', note: 'Initial note' };
  const second = { id: 'row-2', name: 'Middle', note: 'Other note' };
  const third = { id: 'row-3', name: 'Zulu', note: 'Last note' };
  const firstPage: { rows: typeof first[]; nextCursor: string | null } = { rows: [first, second], nextCursor: 'page-2' };
  const secondPage = { rows: [third], nextCursor: null };
  const ordering = { getValue: (row: typeof first) => row.name.toLowerCase(), direction: 'asc' as const };

  /**
   * Mounts an ordered list with isolated cache state and two available cursor pages.
   * @returns Hook controls, cache identity, and the mocked page loader.
   * @example renderList().result.current.loadNextPage() // requests the second page
   */
  function renderList() {
    const client = createTestQueryClient();
    const key = ['refreshable-rows'];
    const queryFn = vi.fn(({ pageParam }: { pageParam: string | null }) => Promise.resolve(pageParam ? secondPage : firstPage));
    const hook = renderHook(() => useInfiniteListQuery({ queryKey: key, queryFn, ordering, errorMessage: 'Unavailable' }), {
      wrapper: createQueryClientWrapper(client),
    });
    return { ...hook, client, key, queryFn };
  }

  it('ignores unrelated edits and changed sort values that still fit, then clears a corrected position', async () => {
    const { result, client, key, queryFn } = renderList();
    await waitFor(() => expect(result.current.rows).toEqual([first, second]));

    act(() => replaceInfiniteListRow(client, key, { ...first, note: 'Changed note' }));
    expect(result.current.refreshNotice).toBeUndefined();
    act(() => replaceInfiniteListRow(client, key, { ...first, name: 'Bravo' }));
    expect(result.current.refreshNotice).toBeUndefined();

    const saved = { ...first, name: 'Zebra' };
    act(() => replaceInfiniteListRow(client, key, saved));
    expect(result.current.rows).toEqual([saved, second]);
    expect(result.current.refreshNotice).toMatchObject({ refreshing: false, onRefresh: expect.any(Function) });
    expect(queryFn).toHaveBeenCalledOnce();

    act(() => replaceInfiniteListRow(client, key, first));
    expect(result.current.refreshNotice).toBeUndefined();
  });

  it('checks adjacent loaded pages and clears the warning when the offending row is deleted', async () => {
    const { result, client, key } = renderList();
    await waitFor(() => expect(result.current.rows).toHaveLength(2));
    act(() => result.current.loadNextPage());
    await waitFor(() => expect(result.current.rows).toHaveLength(3));
    act(() => replaceInfiniteListRow(client, key, { ...third, name: 'Aardvark' }));
    expect(result.current.refreshNotice).toBeDefined();

    act(() => removeInfiniteListRow(client, key, third.id));
    expect(result.current.refreshNotice).toBeUndefined();
  });

  it('checks a newly loaded neighbor without warning about an unseen one', async () => {
    const { result, client, key } = renderList();
    await waitFor(() => expect(result.current.rows).toHaveLength(2));
    act(() => replaceInfiniteListRow(client, key, { ...second, name: 'Zzz' }));
    expect(result.current.refreshNotice).toBeUndefined();

    act(() => result.current.loadNextPage());
    await waitFor(() => expect(result.current.rows).toHaveLength(3));
    expect(result.current.refreshNotice).toBeDefined();
  });

  it('checks authoritative edits replayed into an initially uncached read', async () => {
    const client = createTestQueryClient();
    const key = ['initial-read-order'];
    const pending = deferred<typeof firstPage>();
    const { result } = renderHook(() => useInfiniteListQuery({
      queryKey: key, queryFn: () => pending.promise, ordering, errorMessage: 'Unavailable',
    }), { wrapper: createQueryClientWrapper(client) });
    const saved = { ...first, name: 'Zebra' };
    act(() => replaceInfiniteListRow(client, key, saved));
    act(() => pending.resolve(firstPage));

    await waitFor(() => expect(result.current.rows).toEqual([saved, second]));
    expect(result.current.refreshNotice).toBeDefined();
  });

  it('does not infer ordering beyond a single loaded row', async () => {
    const client = createTestQueryClient();
    const key = ['single-row'];
    const { result } = renderHook(() => useInfiniteListQuery({
      queryKey: key, queryFn: async () => ({ rows: [first], nextCursor: 'unseen' }), ordering, errorMessage: 'Unavailable',
    }), { wrapper: createQueryClientWrapper(client) });
    await waitFor(() => expect(result.current.rows).toHaveLength(1));
    act(() => replaceInfiniteListRow(client, key, { ...first, name: 'Zebra' }));
    expect(result.current.refreshNotice).toBeUndefined();
  });

  it('keeps the notice action stable across equivalent keys and uses the latest request closure', async () => {
    const client = createTestQueryClient();
    const { result, rerender } = renderHook(({ version }) => useInfiniteListQuery({
      queryKey: ['stable-refresh-key'],
      queryFn: async () => ({ rows: [{ ...first, name: `Server ${version}` }, third], nextCursor: null }),
      ordering, errorMessage: 'Unavailable',
    }), { initialProps: { version: 1 }, wrapper: createQueryClientWrapper(client) });
    await waitFor(() => expect(result.current.rows[0]?.name).toBe('Server 1'));
    act(() => replaceInfiniteListRow(client, ['stable-refresh-key'], { ...first, name: 'Zzz saved' }));
    const notice = result.current.refreshNotice;
    rerender({ version: 2 });
    expect(result.current.refreshNotice).toBe(notice);
    act(() => result.current.refreshNotice!.onRefresh());
    await waitFor(() => expect(result.current.rows[0]?.name).toBe('Server 2'));
    expect(result.current.refreshNotice).toBeUndefined();
  });

  it('atomically refreshes only the first page, resets old cursors, and clears the notice', async () => {
    const { result, client, key, queryFn } = renderList();
    await waitFor(() => expect(result.current.rows).toEqual([first, second]));
    act(() => result.current.loadNextPage());
    await waitFor(() => expect(result.current.rows).toEqual([first, second, third]));
    const saved = { ...first, name: 'Zebra' };
    act(() => replaceInfiniteListRow(client, key, saved));
    const pending = deferred<typeof firstPage>();
    queryFn.mockImplementation(() => pending.promise);
    queryFn.mockClear();

    act(() => result.current.refreshNotice!.onRefresh());
    await waitFor(() => expect(result.current.refreshNotice?.refreshing).toBe(true));
    expect(result.current.rows).toEqual([saved, second, third]);
    expect(queryFn).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({ pageParam: null }));
    act(() => pending.resolve({ rows: [second, saved], nextCursor: 'fresh-cursor' }));
    await waitFor(() => expect(result.current.refreshNotice).toBeUndefined());
    expect(result.current.rows).toEqual([second, saved]);
    expect(client.getQueryData(key)).toEqual({ pages: [{ rows: [second, saved], nextCursor: 'fresh-cursor' }], pageParams: [null] });
  });

  it('keeps loaded pages and the warning when refresh fails', async () => {
    const { result, client, key, queryFn } = renderList();
    await waitFor(() => expect(result.current.rows).toHaveLength(2));
    const saved = { ...first, name: 'Zebra' };
    act(() => replaceInfiniteListRow(client, key, saved));
    queryFn.mockRejectedValueOnce(new Error('Refresh failed'));
    act(() => result.current.refreshNotice!.onRefresh());
    await waitFor(() => expect(result.current.error).toBe('Refresh failed'));
    expect(result.current.rows).toEqual([saved, second]);
    expect(result.current.refreshNotice?.refreshing).toBe(false);
  });

  it('retains a newer edit during refresh only when it leaves the returned rows out of order', async () => {
    const { result, client, key, queryFn } = renderList();
    await waitFor(() => expect(result.current.rows).toHaveLength(2));
    const saved = { ...first, name: 'Zebra' };
    act(() => replaceInfiniteListRow(client, key, saved));
    const pending = deferred<typeof firstPage>();
    queryFn.mockImplementation(() => pending.promise);
    act(() => result.current.refreshNotice!.onRefresh());
    await waitFor(() => expect(queryFn).toHaveBeenCalledTimes(2));
    const latest = { ...first, name: 'Aardvark' };
    act(() => replaceInfiniteListRow(client, key, latest));
    act(() => pending.resolve({ rows: [second, saved], nextCursor: null }));
    await waitFor(() => expect(result.current.refreshNotice?.refreshing).toBe(false));
    expect(result.current.rows).toEqual([second, latest]);
    expect(result.current.refreshNotice).toBeDefined();
  });

  it('hides the warning immediately when a correction restores order during refresh', async () => {
    const { result, client, key, queryFn } = renderList();
    await waitFor(() => expect(result.current.rows).toHaveLength(2));
    act(() => replaceInfiniteListRow(client, key, { ...first, name: 'Zebra' }));
    const pending = deferred<typeof firstPage>();
    queryFn.mockImplementation(() => pending.promise);
    act(() => result.current.refreshNotice!.onRefresh());
    await waitFor(() => expect(result.current.refreshNotice?.refreshing).toBe(true));

    act(() => replaceInfiniteListRow(client, key, first));
    expect(result.current.refreshNotice).toBeUndefined();
    expect(result.current.refreshing).toBe(true);
    act(() => pending.resolve(firstPage));
    await waitFor(() => expect(result.current.refreshing).toBe(false));
    expect(result.current.refreshNotice).toBeUndefined();
  });

  it('does not keep a warning for a newer edit that already fits the refreshed rows', async () => {
    const { result, client, key, queryFn } = renderList();
    await waitFor(() => expect(result.current.rows).toHaveLength(2));
    act(() => replaceInfiniteListRow(client, key, { ...first, name: 'Zebra' }));
    const latest = { ...first, name: 'Bravo' };
    queryFn.mockResolvedValueOnce({ rows: [latest, second], nextCursor: null });
    act(() => {
      result.current.refreshNotice!.onRefresh();
      replaceInfiniteListRow(client, key, latest);
    });
    await waitFor(() => expect(queryFn).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(result.current.refreshNotice).toBeUndefined());
    expect(result.current.rows).toEqual([latest, second]);
  });

  it('scopes the notice to its exact query key', async () => {
    const client = createTestQueryClient();
    const { result, rerender } = renderHook(({ order }) => useInfiniteListQuery({
      queryKey: ['notice-key', order], queryFn: async () => firstPage, ordering, errorMessage: 'Unavailable',
    }), { initialProps: { order: 'name' }, wrapper: createQueryClientWrapper(client) });
    await waitFor(() => expect(result.current.rows).toHaveLength(2));
    act(() => replaceInfiniteListRow(client, ['notice-key', 'name'], { ...first, name: 'Zebra' }));
    expect(result.current.refreshNotice).toBeDefined();
    rerender({ order: 'other' });
    expect(result.current.refreshNotice).toBeUndefined();
    await waitFor(() => expect(result.current.rows).toEqual([first, second]));
  });

  it('locks duplicate refreshes and cancels a pending next page without reverting saved rows', async () => {
    const client = createTestQueryClient();
    const key = ['cancel-pending-page'];
    const next = deferred<typeof secondPage>();
    const refreshed = deferred<typeof firstPage>();
    let firstPageReads = 0;
    const queryFn = vi.fn(({ pageParam, signal }: { pageParam: string | null; signal: AbortSignal }) => {
      void signal;
      if (pageParam) return next.promise;
      firstPageReads += 1;
      return firstPageReads === 1 ? Promise.resolve(firstPage) : refreshed.promise;
    });
    const { result } = renderHook(() => useInfiniteListQuery({ queryKey: key, queryFn, ordering, errorMessage: 'Unavailable' }), {
      wrapper: createQueryClientWrapper(client),
    });
    await waitFor(() => expect(result.current.rows).toHaveLength(2));
    act(() => result.current.loadNextPage());
    await waitFor(() => expect(result.current.loadingNextPage).toBe(true));
    const saved = { ...first, name: 'Zebra' };
    act(() => replaceInfiniteListRow(client, key, saved));
    const refresh = result.current.refreshNotice!.onRefresh;
    act(() => { refresh(); refresh(); });
    await waitFor(() => expect(queryFn).toHaveBeenCalledTimes(3));
    expect(result.current.rows).toEqual([saved, second]);
    expect(result.current.refreshNotice?.refreshing).toBe(true);
    expect(result.current.error).toBe('');
    act(() => refreshed.resolve({ rows: [second, saved], nextCursor: null }));
    await waitFor(() => expect(result.current.refreshNotice).toBeUndefined());
    expect(client.getQueryState(key)?.fetchStatus).toBe('idle');
    expect(result.current.loadingNextPage || result.current.refreshing).toBe(false);
    act(() => next.resolve(secondPage));
    expect(client.getQueryData(key)).toEqual({ pages: [{ rows: [second, saved], nextCursor: null }], pageParams: [null] });
  });
});
