import type { ListSort } from '../../types/pagination';

// pattern-review-ignore review-defensive-contract: persisted preference JSON is a legacy-data boundary

export function resolvePreferenceSorting<TKey extends string>(
  value: unknown,
  allowedKeys: readonly TKey[],
  fallback: ListSort<TKey>,
): ListSort<TKey> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return fallback;

  const sorting = value as { key?: unknown; direction?: unknown };
  if (
    typeof sorting.key !== 'string'
    || !allowedKeys.includes(sorting.key as TKey)
    || (sorting.direction !== 'asc' && sorting.direction !== 'desc')
  ) return fallback;

  return { key: sorting.key as TKey, direction: sorting.direction };
}
