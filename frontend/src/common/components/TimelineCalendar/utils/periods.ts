import { Temporal } from 'temporal-polyfill';
import type { CalendarPeriod, PeriodDefinition } from '../types';

/** Shifts a business date by calendar days. @example addDays('2026-08-19', 1) // '2026-08-20' */
export function addDays(value: string, amount: number): string {
  return Temporal.PlainDate.from(value).add({ days: amount }).toString();
}

/** Builds a date-only column with an exclusive end date. @example buildDayPeriod('2026-08-19') // ends August 20 */
export function buildDayPeriod(start: string): CalendarPeriod {
  return { key: start, start, end: addDays(start, 1) };
}

/** Builds a date-only window centered on the supplied day. @example buildInitialDayPeriods('2026-08-19', 3) // August 18–20 */
export function buildInitialDayPeriods(center: string, count: number): CalendarPeriod[] {
  const safeCount = Math.max(1, count);
  const first = addDays(center, -Math.floor(safeCount / 2));
  return Array.from({ length: safeCount }, (_, index) => buildDayPeriod(addDays(first, index)));
}

export const dayPeriodDefinition: PeriodDefinition = {
  navigate: (anchor, direction) => addDays(anchor, direction === 'previous' ? -7 : 7),
  buildInitial: buildInitialDayPeriods,
  formatLabel: period => Temporal.PlainDate.from(period.start).toLocaleString('en-CA', {
    weekday: 'short', month: 'short', day: 'numeric',
  }),
};
