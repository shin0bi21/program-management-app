import { useLayoutEffect, useRef, useState } from 'react';
import { useOptionSearch } from '../../../hooks/useOptionSearch';
import type { FloatingSelectOption } from '../FloatingSelect';

interface UseSelectOptionsArgs {
  id: string;
  value: string;
  options: readonly FloatingSelectOption[];
}

/**
 * Supplies the selector's search results and keyboard-highlighted choice.
 * @param args.options - Available choices, such as programs or staff members.
 * @param args.value - Initial highlight for this mounted popup; unavailable values fall back to the first match.
 * @param args.id - Select control ID used to derive listbox and active-descendant IDs.
 * @returns Search results and controls for searching/highlighting; highlighting does not select.
 * @example With two matches, moving past the second wraps to the first.
 */
export function useSelectOptions({ id, value, options }: UseSelectOptionsArgs) {
  const { search, setSearch, matches } = useOptionSearch(options);
  const [activeValue, setActiveValue] = useState<string | null>(value);
  const listRef = useRef<HTMLDivElement>(null);

  const activeIndex = Math.max(0, matches.findIndex(option => option.value === activeValue));
  const activeOption = matches[activeIndex];
  const listId = `${id}-options`;
  const activeId = activeOption ? `${listId}-${activeIndex}` : undefined;

  useLayoutEffect(() => {
    if (activeId) document.getElementById(activeId)?.scrollIntoView?.({ block: 'nearest' });
  }, [activeId, search]);

  /**
   * Replaces search text and resets highlight/scroll to the first matching choice.
   * @param nextSearch - Label text to match, ignoring letter case.
   * @example Searching 'art' after scrolling starts the matching list at scrollTop=0.
   */
  const changeSearch = (nextSearch: string) => {
    setSearch(nextSearch);
    setActiveValue(null);

    if (listRef.current) listRef.current.scrollTop = 0;
  };

  /**
   * Moves one highlight with wraparound; empty match sets remain unchanged.
   * @param offset - 1 for the next match, or -1 for the previous match.
   * @example Moving -1 from the first of three matches highlights the third.
   */
  const moveActiveOption = (offset: 1 | -1) => {
    if (matches.length === 0) return;

    const nextIndex = (activeIndex + offset + matches.length) % matches.length;
    setActiveValue(matches[nextIndex].value);
  };

  return {
    search,
    changeSearch,
    matches,
    activeIndex,
    activeOption,
    activeId,
    listId,
    listRef,
    setActiveValue,
    moveActiveOption,
  };
}
