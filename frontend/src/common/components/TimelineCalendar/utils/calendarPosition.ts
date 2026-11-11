import { isDateKey } from '../../../utils/dateRange';

export interface CalendarPosition {
  date: string;
  offset: number;
}

/**
 * Restores a saved date/offset and removes malformed stored values.
 * Example: an absent or invalid saved value returns fallbackDate with offset zero.
 */
export function loadCalendarPosition(storageKey: string | undefined, fallbackDate: string): CalendarPosition {
  if (!storageKey) return { date: fallbackDate, offset: 0 };

  const stored = localStorage.getItem(storageKey);

  if (!stored) return { date: fallbackDate, offset: 0 };

  let parsed: unknown;

  try {
    parsed = JSON.parse(stored);
  } catch {
    parsed = null;
  }

  const candidate = parsed as { date?: unknown; offset?: unknown } | null;
  const date = isDateKey(candidate?.date) ? candidate.date : null;

  if (!date || typeof candidate?.offset !== 'number' || !Number.isFinite(candidate.offset) || candidate.offset < 0) {
    localStorage.removeItem(storageKey);
    return { date: fallbackDate, offset: 0 };
  }

  return { date, offset: candidate.offset };
}

/**
 * Persists the visible date key and offset when storage is configured.
 * Requires: dateKey is valid and offset is nonnegative; e.g. saveCalendarPosition(key, '2026-08-19', 37).
 */
export function saveCalendarPosition(
  storageKey: string | undefined,
  dateKey: string,
  offset: number,
) {
  if (storageKey) localStorage.setItem(storageKey, JSON.stringify({ date: dateKey, offset }));
}
