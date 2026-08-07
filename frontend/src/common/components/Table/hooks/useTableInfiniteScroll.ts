import { useEffect, useRef, type RefObject } from 'react';
import { INFINITE_SCROLL_ROOT_MARGIN } from '../table.utils';

interface UseTableInfiniteScrollOptions {
  rootRef: RefObject<HTMLDivElement>;
  dataLength: number;
  hasNextPage: boolean;
  loadingNextPage: boolean;
  refreshing: boolean;
  onLoadNextPage?: () => void;
}

export default function useTableInfiniteScroll({
  rootRef,
  dataLength,
  hasNextPage,
  loadingNextPage,
  refreshing,
  onLoadNextPage,
}: UseTableInfiniteScrollOptions) {
  const sentinelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const sentinel = sentinelRef.current;
    const root = rootRef.current;
    if (!sentinel || !root || !hasNextPage || !onLoadNextPage || refreshing) return;

    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting && !loadingNextPage) onLoadNextPage();
    }, { root, rootMargin: INFINITE_SCROLL_ROOT_MARGIN });

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [dataLength, hasNextPage, loadingNextPage, onLoadNextPage, refreshing, rootRef]);

  return sentinelRef;
}
