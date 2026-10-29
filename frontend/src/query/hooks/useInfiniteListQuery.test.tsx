import { createTestQueryClient, createQueryClientWrapper } from '../../tests/queryClientTestUtils';
import { act, renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import useInfiniteListQuery from './useInfiniteListQuery';

interface Row { id: string; name: string }

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

  it('keeps existing rows while a changed query key refreshes', async () => {
    const first = deferred<{ rows: Row[]; nextCursor: null }>();
    const second = deferred<{ rows: Row[]; nextCursor: null }>();
    const client = createTestQueryClient();
    const wrapper = createQueryClientWrapper(client);
    const { result, rerender } = renderHook(
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
    await waitFor(() => expect(result.current.refreshing).toBe(true));
    expect(result.current.rows).toEqual([{ id: '1', name: 'First' }]);

    act(() => second.resolve({ rows: [{ id: '2', name: 'Second' }], nextCursor: null }));
    await waitFor(() => expect(result.current.rows).toEqual([{ id: '2', name: 'Second' }]));
    expect(result.current.refreshing).toBe(false);
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
