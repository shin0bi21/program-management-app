import type { ListSort } from '../../components/Table/Table.types';

// pattern-review-ignore review-defensive-contract: persisted preference JSON is a legacy-data boundary

export function mergePreferenceDefaults<T extends object>(
  defaults: T,
  value: Partial<T> | null,
): T {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return { ...defaults };
  return { ...defaults, ...value };
}

export function resolvePreferenceValue<T extends string>(
  value: unknown,
  allowedValues: readonly T[],
  fallback: T,
): T {
  return typeof value === 'string' && allowedValues.includes(value as T)
    ? value as T
    : fallback;
}

export function resolvePreferenceString(value: unknown, fallback = '') {
  return typeof value === 'string' ? value.trim() : fallback;
}

export function resolvePreferenceStringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === 'string')
    : [];
}

export function resolvePreferenceNumberRecord(value: unknown): Record<string, number> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};

  return Object.fromEntries(
    Object.entries(value).filter((entry): entry is [string, number] => (
      typeof entry[1] === 'number' && Number.isFinite(entry[1]) && entry[1] > 0
    )),
  );
}

export function resolveAvailablePreferenceIds(
  value: unknown,
  options: ReadonlyArray<{ id: string }> | undefined,
  canVerifyOptions: boolean,
) {
  const values = resolvePreferenceStringArray(value);
  if (!canVerifyOptions) return values;

  const availableIds = new Set(options?.map(option => option.id) ?? []);
  return values.filter(id => availableIds.has(id));
}

export function resolveAvailablePreferenceValues<T extends string>(
  value: unknown,
  options: ReadonlyArray<{ value: T }> | undefined,
  canVerifyOptions: boolean,
): T[] {
  const values = resolvePreferenceStringArray(value);
  if (!canVerifyOptions) return values as T[];

  return (options ?? [])
    .filter(option => values.includes(option.value))
    .map(option => option.value);
}

export function haveSamePreferenceValues(current: readonly string[], next: readonly string[]) {
  return current.length === next.length
    && current.every((value, index) => value === next[index]);
}

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
