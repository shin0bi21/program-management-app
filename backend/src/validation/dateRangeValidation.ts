import { z } from 'zod';

export const MAX_DATE_RANGE_DAYS = 366;
export const DATE_RANGE_LIMIT_MESSAGE = `Date range cannot exceed ${MAX_DATE_RANGE_DAYS} days`;
const DAY_MS = 86_400_000;

export function isCalendarDate(value: string) {
  if (!/^(?!0000)\d{4}-\d{2}-\d{2}$/.test(value)) return false;

  const parsed = new Date(`${value}T00:00:00Z`);
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

export function calendarDateSchema(label = 'Date') {
  return z.string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, `${label} must use YYYY-MM-DD`)
    .refine(isCalendarDate, `${label} must be a valid calendar date`);
}

export function exceedsDateRangeLimit(start?: string, end?: string) {
  if (!start || !end || !isCalendarDate(start) || !isCalendarDate(end) || start > end) return false;

  const days = (Date.parse(`${end}T00:00:00Z`) - Date.parse(`${start}T00:00:00Z`)) / DAY_MS + 1;
  return days > MAX_DATE_RANGE_DAYS;
}

// Gregorian era parts are consistent across the host and Docker Node/ICU builds.
const torontoDate = new Intl.DateTimeFormat('en-US', {
  timeZone: 'America/Toronto', calendar: 'gregory', numberingSystem: 'latn',
  year: 'numeric', month: '2-digit', day: '2-digit', era: 'short',
});

function torontoDateKey(timestamp: number) {
  const parts = torontoDate.formatToParts(new Date(timestamp));
  const part = (type: Intl.DateTimeFormatPartTypes) => parts.find(value => value.type === type)?.value;
  if (part('era') !== 'AD') return null;

  const key = `${part('year')?.padStart(4, '0')}-${part('month')}-${part('day')}`;
  return isCalendarDate(key) ? key : null;
}

export function sessionRangeCalendarDates(start: string, end: string) {
  const startTime = Date.parse(start);
  const endTime = Date.parse(end);
  if (!Number.isFinite(startTime) || !Number.isFinite(endTime) || startTime >= endTime) return null;

  // The API end is exclusive; count Toronto calendar days rather than elapsed 24-hour blocks.
  const firstDate = torontoDateKey(startTime);
  const lastDate = torontoDateKey(endTime - 1);
  return firstDate && lastDate ? { start: firstDate, end: lastDate } : null;
}
