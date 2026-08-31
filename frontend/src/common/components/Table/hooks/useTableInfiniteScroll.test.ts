// Owns table-sentinel observation, load guards, and observer cleanup.
import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { INFINITE_SCROLL_ROOT_MARGIN } from '../table.utils';
import useTableInfiniteScroll from './useTableInfiniteScroll';

afterEach(() => vi.unstubAllGlobals());

describe('useTableInfiniteScroll', () => {
  it('loads the next page when its sentinel intersects and disconnects on cleanup', () => {
    let notify: IntersectionObserverCallback | undefined;
    const observe = vi.fn();
    const disconnect = vi.fn();
    const root = document.createElement('div');
    const sentinel = document.createElement('div');
    vi.stubGlobal('IntersectionObserver', vi.fn(function (
      callback: IntersectionObserverCallback,
      options?: IntersectionObserverInit,
    ) {
      notify = callback;
      expect(options).toEqual({ root, rootMargin: INFINITE_SCROLL_ROOT_MARGIN });
      return { observe, disconnect };
    }));
    const onLoadNextPage = vi.fn();
    const { result, rerender, unmount } = renderHook(
      ({ dataLength }) => useTableInfiniteScroll({
        rootRef: { current: root },
        dataLength,
        hasNextPage: true,
        loadingNextPage: false,
        refreshing: false,
        onLoadNextPage,
      }),
      { initialProps: { dataLength: 0 } },
    );
    (result.current as { current: HTMLDivElement | null }).current = sentinel;

    rerender({ dataLength: 1 });
    expect(observe).toHaveBeenCalledWith(sentinel);

    act(() => notify?.(
      [{ isIntersecting: true } as IntersectionObserverEntry],
      {} as IntersectionObserver,
    ));
    expect(onLoadNextPage).toHaveBeenCalledOnce();

    unmount();
    expect(disconnect).toHaveBeenCalledOnce();
  });

  it('skips unavailable or refreshing pagination and suppresses duplicate loads while busy', () => {
    const observer = vi.fn();
    vi.stubGlobal('IntersectionObserver', observer);
    const root = document.createElement('div');
    const sentinel = document.createElement('div');
    const onLoadNextPage = vi.fn();
    const { result, rerender } = renderHook(
      ({ hasNextPage, loadingNextPage, refreshing }) => useTableInfiniteScroll({
        rootRef: { current: root },
        dataLength: 1,
        hasNextPage,
        loadingNextPage,
        refreshing,
        onLoadNextPage,
      }),
      {
        initialProps: {
          hasNextPage: false,
          loadingNextPage: false,
          refreshing: false,
        },
      },
    );
    (result.current as { current: HTMLDivElement | null }).current = sentinel;

    rerender({ hasNextPage: false, loadingNextPage: false, refreshing: false });
    rerender({ hasNextPage: true, loadingNextPage: false, refreshing: true });
    expect(observer).not.toHaveBeenCalled();

    // A loading observer may remain mounted, but its callback must not request another page.
    let notify: IntersectionObserverCallback | undefined;
    vi.stubGlobal('IntersectionObserver', vi.fn(function (callback: IntersectionObserverCallback) {
      notify = callback;
      return { observe: vi.fn(), disconnect: vi.fn() };
    }));
    rerender({ hasNextPage: true, loadingNextPage: true, refreshing: false });
    act(() => notify?.(
      [{ isIntersecting: true } as IntersectionObserverEntry],
      {} as IntersectionObserver,
    ));
    expect(onLoadNextPage).not.toHaveBeenCalled();
  });
});
