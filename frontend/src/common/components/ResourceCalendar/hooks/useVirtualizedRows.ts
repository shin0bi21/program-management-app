import { useMemo, useRef } from 'react';

export function useVirtualizedRows<TResource>(
  resources: readonly TResource[],
  scrollTop: number,
  viewportHeight: number,
  rowHeight: number,
  headerHeight: number,
  overscanRows: number,
) {
  const previousRef = useRef<{
    source: readonly TResource[];
    first: number;
    last: number;
    resources: readonly TResource[];
  }>();
  return useMemo(() => {
    const bodyScrollTop = Math.max(0, scrollTop - headerHeight);
    const first = Math.max(0, Math.floor(bodyScrollTop / rowHeight) - overscanRows);
    const count = Math.ceil(Math.max(0, viewportHeight - headerHeight) / rowHeight) + overscanRows * 2;
    const last = Math.min(resources.length, first + count);
    const previous = previousRef.current;
    if (previous?.source === resources && previous.first === first && previous.last === last) {
      return previous;
    }
    const next = { source: resources, first, last, resources: resources.slice(first, last) };
    previousRef.current = next;
    return next;
  }, [headerHeight, overscanRows, resources, rowHeight, scrollTop, viewportHeight]);
}
