import type { ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import useInfiniteListQuery from './useInfiniteListQuery';

interface Row { id: string; name: string }

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>(next => { resolve = next; });
  return { promise, resolve };
}

describe('useInfiniteListQuery', () => {
  it('keeps existing rows while a changed query key refreshes', async () => {
    const first = deferred<{ rows: Row[]; nextCursor: null }>();
    const second = deferred<{ rows: Row[]; nextCursor: null }>();
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    );
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
});
