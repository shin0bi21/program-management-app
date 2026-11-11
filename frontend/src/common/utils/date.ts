import { Intl as TemporalIntl, Temporal } from 'temporal-polyfill';

const shortDateFormatter = new TemporalIntl.DateTimeFormat('en-CA', {
  year: 'numeric',
  month: 'short',
  day: 'numeric',
  timeZone: 'America/Toronto',
});

/**
 * Formats an hour duration with up to two decimal places and its unit.
 * @param hours - Recorded duration in hours.
 * @example formatHours(1.5) // '1.5 hours'
 */
export function formatHours(hours: number): string {
  const value = hours.toLocaleString('en-CA', { maximumFractionDigits: 2 });
  return `${value} ${hours === 1 ? 'hour' : 'hours'}`;
}

/**
 * Formats business dates directly and event timestamps on the program's Eastern date.
 * @param value - YYYY-MM-DD business date, timestamp, epoch milliseconds, or Date.
 * @example formatShortDate('2026-07-01') // 'Jul 1, 2026'
 */
export function formatShortDate(value: string | number | Date): string {
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return shortDateFormatter.format(Temporal.PlainDate.from(value));
  }
  return shortDateFormatter.format(value instanceof Date ? value : new Date(value));
}

/**
 * Formats an inclusive business-date range, collapsing repeated month and year labels.
 * @param start - First YYYY-MM-DD date in the range.
 * @param end - Last YYYY-MM-DD date, on or after start.
 * @example formatShortDateRange('2026-07-29', '2026-08-11') // 'Jul 29 – Aug 11, 2026'
 */
export function formatShortDateRange(start: string, end: string): string {
  return shortDateFormatter.formatRange(Temporal.PlainDate.from(start), Temporal.PlainDate.from(end)).replace('–', ' – ');
}

/** Returns today's local calendar date. @example getDate() // '2026-11-10' */
export function getDate(): string {
  return Temporal.Now.plainDateISO().toString();
}
