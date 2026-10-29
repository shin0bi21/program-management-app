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

export function isDateRange(value: unknown): value is DateRange {
  if (!value || typeof value !== 'object') return false;

  const { start, end } = value as Partial<DateRange>;
  return isDateKey(start) && isDateKey(end) && start <= end;
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
