import { useVirtualizer } from '@tanstack/react-virtual';
import { useMemo, type RefObject } from 'react';

export function useVirtualizedResources<TResource>(
  resources: readonly TResource[],
  viewportRef: RefObject<HTMLElement | null>,
  rowHeight: number,
  headerHeight: number,
  overscanRows: number,
) {
  const virtualizer = useVirtualizer({
    count: resources.length,
    getScrollElement: () => viewportRef.current,
    estimateSize: () => rowHeight,
    overscan: overscanRows,
    scrollMargin: headerHeight,
  });
  const virtualItems = virtualizer.getVirtualItems();
  const first = virtualItems[0]?.index ?? 0;
  const last = virtualItems.length ? virtualItems[virtualItems.length - 1].index + 1 : 0;
  return useMemo(() => ({
    first,
    last,
    resources: resources.slice(first, last),
  }), [first, last, resources]);
}
