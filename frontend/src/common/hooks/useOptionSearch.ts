import { useState } from 'react';

/**
 * Supplies search text and choices whose display names contain that text, ignoring letter case.
 * @param options - Already loaded choices, such as staff names or programs.
 * @param enabled - Whether to filter; false returns all choices even when search text exists.
 * @returns Search state and setter, a lowercase query (empty when disabled), and matches preserving option identity.
 * Empty queries return the original options array; disabling filtering retains the search text.
 * @example With names ['Alpha', 'Beta'], setSearch('AL') makes query 'al' and matches contain only Alpha on the next render.
 */
export function useOptionSearch<T extends { name: string }>(options: readonly T[], enabled = true) {
  const [search, setSearch] = useState('');
  const query = enabled ? search.toLowerCase() : '';
  const matches = query ? options.filter(option => option.name.toLowerCase().includes(query)) : options;

  return { search, setSearch, query, matches };
}
