import { useLayoutEffect, useRef, useState } from 'react';
import { useOptionSearch } from '../../../hooks/useOptionSearch';
import type { FloatingSelectOption } from '../FloatingSelect';

interface UseSelectOptionsArgs {
  id: string;
  value: string;
  options: readonly FloatingSelectOption[];
}

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

  const changeSearch = (nextSearch: string) => {
    setSearch(nextSearch);
    setActiveValue(null);

    if (listRef.current) listRef.current.scrollTop = 0;
  };

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
