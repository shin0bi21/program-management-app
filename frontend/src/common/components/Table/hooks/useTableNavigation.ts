import { useCallback, useEffect, useRef, type RefObject } from 'react';
import type { TableNavigationKey } from '../Table.types';

interface UseTableNavigationOptions<T> {
  data: T[];
  keyExtractor: (item: T) => string;
  selectedKey?: string | null;
  scrollToSelected: boolean;
  onRowSelect?: (item: T) => void;
  wrapperRef: RefObject<HTMLDivElement>;
}

export default function useTableNavigation<T>({
  data,
  keyExtractor,
  selectedKey,
  scrollToSelected,
  onRowSelect,
  wrapperRef,
}: UseTableNavigationOptions<T>) {
  const lastScrolledSelectionRef = useRef<string | null>(null);
  const selectedIndex = selectedKey == null
    ? -1
    : data.findIndex(item => keyExtractor(item) === selectedKey);
  const tabbableIndex = selectedIndex >= 0 ? selectedIndex : 0;

  useEffect(() => {
    if (!scrollToSelected || selectedKey == null) {
      lastScrolledSelectionRef.current = null;
      return;
    }
    if (selectedIndex < 0) {
      if (data.length === 0) lastScrolledSelectionRef.current = null;
      return;
    }
    if (lastScrolledSelectionRef.current === selectedKey) return;

    wrapperRef.current
      ?.querySelector<HTMLTableRowElement>('.table-row--selected')
      ?.scrollIntoView?.({ block: 'nearest' });
    lastScrolledSelectionRef.current = selectedKey;
  }, [data.length, scrollToSelected, selectedIndex, selectedKey, wrapperRef]);

  const navigateRows = useCallback((currentIndex: number, key: TableNavigationKey) => {
    if (data.length === 0) return;

    let nextIndex = currentIndex;
    if (key === 'ArrowUp') nextIndex = Math.max(0, currentIndex - 1);
    if (key === 'ArrowDown') nextIndex = Math.min(data.length - 1, currentIndex + 1);
    if (key === 'Home') nextIndex = 0;
    if (key === 'End') nextIndex = data.length - 1;

    onRowSelect?.(data[nextIndex]);
    wrapperRef.current
      ?.querySelector<HTMLTableRowElement>(`tr[data-table-row-index="${nextIndex}"]`)
      ?.focus();
  }, [data, onRowSelect, wrapperRef]);

  return { navigateRows, tabbableIndex };
}
