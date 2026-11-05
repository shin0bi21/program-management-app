import { useLayoutEffect, useRef, useState } from 'react';
import { useOptionSearch } from '../../../hooks/useOptionSearch';

interface ChecklistOption {
  value: string;
  label: string;
}

interface ChecklistItemsOptions {
  options: readonly ChecklistOption[];
  dynamicItems: boolean;
  searchEnabled: boolean;
}

const BATCH_SIZE = 25;

export function useChecklistItems({ options, dynamicItems, searchEnabled }: ChecklistItemsOptions) {
  const itemsRef = useRef<HTMLDivElement>(null);
  const { search, setSearch, query, matches } = useOptionSearch(options, searchEnabled);
  const [visibleCount, setVisibleCount] = useState(BATCH_SIZE);

  const items = dynamicItems ? matches.slice(0, visibleCount) : matches;
  const hasMoreItems = items.length < matches.length;

  useLayoutEffect(() => {
    // Reset before paint so a new search never displays the previous batch or scroll offset.
    setVisibleCount(BATCH_SIZE);
    if (itemsRef.current) itemsRef.current.scrollTop = 0;
  }, [query, dynamicItems]);

  const loadMoreItems = () => {
    if (!dynamicItems || !hasMoreItems) return;

    setVisibleCount(current => Math.min(current + BATCH_SIZE, matches.length));
  };

  const handleScroll = () => {
    const container = itemsRef.current;
    if (!container || container.clientHeight === 0) return;

    const distanceToBottom = container.scrollHeight - container.scrollTop - container.clientHeight;
    if (distanceToBottom <= 32) loadMoreItems();
  };

  return { itemsRef, search, setSearch, items, hasMoreItems, loadMoreItems, handleScroll };
}
