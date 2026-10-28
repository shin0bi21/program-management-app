import type { CalendarPeriod, PeriodDefinition } from '../types';

/** Shifts by local calendar days across DST; e.g. Aug 19 plus one day produces local midnight on Aug 20. */
export function addDays(value: Date, amount: number): Date {
  const next = new Date(value);
  next.setDate(next.getDate() + amount);
  return startOfLocalDay(next);
}

/** Formats the local year and padded month/day; e.g. Aug 19, 2026 produces '2026-08-19'. */
export function dayKey(value: Date): string {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, '0');
  const day = String(value.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/** Produces a local-day period; e.g. Aug 19 spans local midnight on Aug 19 through midnight on Aug 20. */
export function buildDayPeriod(start: Date): CalendarPeriod {
  const normalizedStart = startOfLocalDay(start);
  return {
    key: dayKey(normalizedStart),
    start: normalizedStart,
    end: addDays(normalizedStart, 1),
  };
}

/**
 * Produces at least one local-day period centered on the requested date.
 * Example: a count of three includes the preceding day, the requested day, and the following day.
 */
export function buildInitialDayPeriods(center: Date, count: number): CalendarPeriod[] {
  const safeCount = Math.max(1, count);
  const first = addDays(center, -Math.floor(safeCount / 2));
  return Array.from({ length: safeCount }, (_, index) => buildDayPeriod(addDays(first, index)));
}

const dayLabelFormatter = new Intl.DateTimeFormat('en-CA', {
  weekday: 'short', month: 'short', day: 'numeric',
});

export const dayPeriodDefinition: PeriodDefinition = {
  navigate: (anchor, direction) => addDays(anchor, direction === 'previous' ? -7 : 7),
  buildInitial: buildInitialDayPeriods,
  formatLabel: period => dayLabelFormatter.format(period.start),
};

/** Normalizes a date to local midnight without changing its calendar day. */
function startOfLocalDay(value: Date): Date {
  return new Date(value.getFullYear(), value.getMonth(), value.getDate());
}
