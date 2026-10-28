import { getDefaultDateRange, isDateRange, type DateRange } from '../../utils/dateRange';
import type { ListSort } from '../../components/Table/Table.types';

export type PreferenceFields<T extends object> = { [K in keyof T]: (value: unknown) => T[K] };

function isPreferenceObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function readPreferenceStrings(value: unknown, fallback: readonly string[]): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === 'string')
    : [...fallback];
}

export function preferenceOption<T extends string>(allowed: readonly T[], fallback: T) {
  return (value: unknown): T => (
    typeof value === 'string' && allowed.includes(value as T) ? value as T : fallback
  );
}

export function optionalPreferenceOption<T extends string>(allowed: readonly T[], fallback: T | null = null) {
  return (value: unknown): T | null => {
    if (value === null) return null;
    return typeof value === 'string' && allowed.includes(value as T) ? value as T : fallback;
  };
}

export function preferenceOptions<T extends string>(
  allowed: readonly T[],
  fallback: readonly T[] = [],
  available: readonly T[] | null = allowed,
) {
  return (value: unknown): T[] => readPreferenceStrings(value, fallback)
    .filter((item): item is T => allowed.includes(item as T))
    .filter(item => available === null || available.includes(item));
}

export function preferenceIds(available: readonly string[] | undefined, fallback: readonly string[] = []) {
  return (value: unknown): string[] => {
    const selected = readPreferenceStrings(value, fallback);
    return available === undefined ? selected : selected.filter(id => available.includes(id));
  };
}

export function optionalPreferenceId(available: readonly string[] | undefined, fallback: string | null = null) {
  return (value: unknown): string | null => {
    if (value === null) return null;
    const selected = typeof value === 'string' ? value : fallback;
    if (selected === null || available === undefined) return selected;
    return available.includes(selected) ? selected : null;
  };
}

export function preferenceSorting<T extends string>(keys: readonly T[], fallback: ListSort<T>) {
  return (value: unknown): ListSort<T> => {
    if (!isPreferenceObject(value)) return fallback;
    const { key, direction } = value;
    if (typeof key !== 'string' || !keys.includes(key as T)) return fallback;
    if (direction !== 'asc' && direction !== 'desc') return fallback;
    return { key: key as T, direction };
  };
}

export function preferenceColumnWidths(keys: readonly string[]) {
  return (value: unknown): Record<string, number> => {
    if (!isPreferenceObject(value)) return {};
    return Object.fromEntries(Object.entries(value).filter(
      (entry): entry is [string, number] => keys.includes(entry[0])
        && typeof entry[1] === 'number' && Number.isFinite(entry[1]) && entry[1] > 0,
    ));
  };
}

export function preferenceText(fallback = '') {
  return (value: unknown) => typeof value === 'string' ? value.trim() : fallback;
}

export function fixedPreference<T>(value: T) {
  return (_stored: unknown): T => value;
}

export function preferenceHiddenColumns(keys: readonly string[]) {
  return preferenceIds(keys);
}

function equalPreferenceValues(left: unknown, right: unknown): boolean {
  if (left === right) return true;
  if (Array.isArray(left) && Array.isArray(right)) {
    return left.length === right.length && left.every((item, index) => equalPreferenceValues(item, right[index]));
  }
  if (!isPreferenceObject(left) || !isPreferenceObject(right)) return false;
  const keys = Object.keys(left);
  return keys.length === Object.keys(right).length
    && keys.every(key => Object.prototype.hasOwnProperty.call(right, key) && equalPreferenceValues(left[key], right[key]));
}

// Persisted JSON is untrusted. Each field repairs itself without discarding valid sibling fields.
export function normalizePreferences<T extends object>(fields: PreferenceFields<T>, stored: unknown): T {
  const source = isPreferenceObject(stored) ? stored : {};
  const normalized = Object.fromEntries(
    Object.entries<(value: unknown) => unknown>(fields).map(([key, normalize]) => [key, normalize(source[key])]),
  ) as T;

  return equalPreferenceValues(stored, normalized) ? stored as T : normalized;
}

export function preferenceDateRange(fallback: DateRange = getDefaultDateRange()) {
  return (value: unknown): DateRange => isDateRange(value)
    ? { start: value.start, end: value.end } : fallback;
}
