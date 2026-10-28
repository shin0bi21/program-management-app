export const MAX_DATE_RANGE_DAYS = 366;

export interface DateRange {
  start: string;
  end: string;
}

export function isDateKey(value: unknown): value is string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  if (value.startsWith('0000-')) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

export function getDateRangeError(range: { start?: unknown; end?: unknown }): string | null {
  if (!isDateKey(range.start) || !isDateKey(range.end) || range.start > range.end) {
    return 'Choose valid dates with the end on or after the start.';
  }

  const days = (Date.parse(`${range.end}T00:00:00Z`) - Date.parse(`${range.start}T00:00:00Z`)) / 86_400_000 + 1;
  return days > MAX_DATE_RANGE_DAYS
    ? `Choose a date range of one year or less (maximum ${MAX_DATE_RANGE_DAYS} days).`
    : null;
}

export function isDateRange(value: unknown): value is DateRange {
  if (!value || typeof value !== 'object') return false;
  return getDateRangeError(value as Partial<DateRange>) === null;
}

export function getDefaultDateRange(): DateRange {
  const year = new Date().getFullYear();
  return { start: `${year}-01-01`, end: `${year}-12-31` };
}

export function localDateFromKey(key: string): Date {
  const [year, month, day] = key.split('-').map(Number);
  const date = new Date(0);
  date.setFullYear(year, month - 1, day);
  date.setHours(0, 0, 0, 0);
  return date;
}

export function intersectDateRanges(requested: DateRange, bounds?: DateRange): DateRange | null {
  if (!bounds) return requested;
  const start = requested.start > bounds.start ? requested.start : bounds.start;
  const end = requested.end < bounds.end ? requested.end : bounds.end;
  return start <= end ? { start, end } : null;
}
