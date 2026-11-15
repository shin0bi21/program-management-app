/**
 * Finds choice IDs whose stored ID or display name contains the search text, ignoring case.
 * @param options - Canonical named choices; matching preserves their order.
 * @param search - Optional search text; omission or an empty string produces no matches.
 * @example getMatchingReferenceIds([{ id: 'planning_prep', name: 'Planning / Prep' }], '/ prep') // ['planning_prep']
 */
export function getMatchingReferenceIds<T extends string>(options: readonly { id: T; name: string }[], search?: string): T[] {
  if (!search) return [];

  const query = search.toLowerCase();
  return options
    .filter(option => option.name.toLowerCase().includes(query) || option.id.toLowerCase().includes(query))
    .map(option => option.id);
}
