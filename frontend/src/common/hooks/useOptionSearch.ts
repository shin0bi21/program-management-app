import { useState } from 'react';

export function useOptionSearch<T extends { label: string }>(options: readonly T[], enabled = true) {
  const [search, setSearch] = useState('');
  const query = enabled ? search.toLowerCase() : '';
  const matches = query ? options.filter(option => option.label.toLowerCase().includes(query)) : options;

  return { search, setSearch, query, matches };
}
