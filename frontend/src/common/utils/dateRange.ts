import { Temporal } from 'temporal-polyfill';

export interface DateRange {
  start: string;
  end: string;
}

/** Checks for a real YYYY-MM-DD date in years 0001–9999. @example isDateKey('2026-02-30') // false */
export function isDateKey(value: unknown): value is string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  if (value.startsWith('0000-')) return false;
  try {
    Temporal.PlainDate.from(value);
    return true;
  } catch {
    return false;
  }
}

/** Checks for valid, ordered inclusive bounds. @example isDateRange({ start: '2026-05-01', end: '2026-05-03' }) // true */
export function isDateRange(value: unknown): value is DateRange {
  if (!value || typeof value !== 'object') return false;

  const { start, end } = value as Partial<DateRange>;
  return isDateKey(start) && isDateKey(end) && start <= end;
}

/** Returns the overlap, or null for disjoint ranges. @example intersectDateRanges({ start: '2026-05-01', end: '2026-05-03' }) // unchanged range */
export function intersectDateRanges(requested: DateRange, bounds?: DateRange): DateRange | null {
  if (!bounds) return requested;
  const start = requested.start > bounds.start ? requested.start : bounds.start;
  const end = requested.end < bounds.end ? requested.end : bounds.end;
  return start <= end ? { start, end } : null;
}

/**
 * Keeps a business date within an optional inclusive date range.
 * @param date - Valid YYYY-MM-DD business date to bound.
 * @param dateRange - Valid ordered earliest/latest dates, both included; omit to leave date unchanged.
 * @returns The original date when no bounds apply, or the nearest allowed business date.
 * @example Navigating to May 4 with May 1–3 bounds returns May 3.
 */
export function getBoundedDate(date: string, dateRange?: DateRange): string {
  if (!dateRange) return date;

  if (date < dateRange.start) return dateRange.start;
  if (date > dateRange.end) return dateRange.end;
  return date;
}
