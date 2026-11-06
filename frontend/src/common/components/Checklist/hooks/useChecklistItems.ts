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

/**
 * Supplies matching checklist choices, optionally revealing 25 at a time.
 * Attach itemsRef and handleScroll to the choices' scroll container; query or dynamic-mode changes reset its scroll and batch.
 * @param options.options - Available choices, such as youth names or statuses.
 * @param options.dynamicItems - Whether scrolling/focus reveals another batch of choices.
 * @param options.searchEnabled - Whether search text filters choices by their label.
 * @returns Displayed choices, search controls, and handlers for revealing more choices.
 * @example With dynamicItems enabled, searching 100 choices for 30 matches reveals 25; loadMoreItems reveals the last five.
 */
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

  /**
   * Reveals one bounded batch when dynamic choices remain.
   * @example With 30 matches and 25 visible, the next batch reveals all 30.
   */
  const loadMoreItems = () => {
    if (!dynamicItems || !hasMoreItems) return;

    setVisibleCount(current => Math.min(current + BATCH_SIZE, matches.length));
  };

  /**
   * Requests another batch within 32px of a measurable scrollport's bottom.
   * @example A hidden zero-height container does not eagerly reveal all choices.
   */
  const handleScroll = () => {
    const container = itemsRef.current;
    if (!container || container.clientHeight === 0) return;

    const distanceToBottom = container.scrollHeight - container.scrollTop - container.clientHeight;
    if (distanceToBottom <= 32) loadMoreItems();
  };

  return { itemsRef, search, setSearch, items, hasMoreItems, loadMoreItems, handleScroll };
}
