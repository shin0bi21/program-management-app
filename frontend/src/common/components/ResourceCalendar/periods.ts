import type { CalendarPeriod, PeriodDefinition } from './types';

function startOfLocalDay(value: Date): Date {
  return new Date(value.getFullYear(), value.getMonth(), value.getDate());
}

export function addDays(value: Date, amount: number): Date {
  const next = new Date(value);
  next.setDate(next.getDate() + amount);
  return startOfLocalDay(next);
}

export function dayKey(value: Date): string {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, '0');
  const day = String(value.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function buildDayPeriod(start: Date): CalendarPeriod {
  const normalizedStart = startOfLocalDay(start);
  return {
    key: dayKey(normalizedStart),
    start: normalizedStart,
    end: addDays(normalizedStart, 1),
  };
}

export function buildInitialDayPeriods(center: Date, count: number): CalendarPeriod[] {
  const safeCount = Math.max(1, count);
  const first = addDays(center, -Math.floor(safeCount / 2));
  return Array.from({ length: safeCount }, (_, index) => buildDayPeriod(addDays(first, index)));
}

export function extendDayPeriods(
  periods: readonly CalendarPeriod[],
  direction: 'left' | 'right',
  count: number,
): CalendarPeriod[] {
  if (!periods.length) return [];

  const safeCount = Math.max(1, count);
  if (direction === 'right') {
    const last = periods[periods.length - 1].start;
    return Array.from({ length: safeCount }, (_, index) => buildDayPeriod(addDays(last, index + 1)));
  }

  const first = periods[0].start;
  return Array.from(
    { length: safeCount },
    (_, index) => buildDayPeriod(addDays(first, index - safeCount)),
  );
}

export function shiftDayPeriodWindow(
  periods: readonly CalendarPeriod[],
  direction: 'left' | 'right',
  buildCount: number,
  windowSize: number,
): { periods: CalendarPeriod[]; built: CalendarPeriod[] } {
  const built = extendDayPeriods(periods, direction, buildCount);
  const combined = direction === 'left' ? [...built, ...periods] : [...periods, ...built];
  return {
    built,
    periods: direction === 'left'
      ? combined.slice(0, windowSize)
      : combined.slice(-windowSize),
  };
}

const dayLabelFormatter = new Intl.DateTimeFormat('en-CA', {
  weekday: 'short', month: 'short', day: 'numeric',
});

export const dayPeriodDefinition: PeriodDefinition = {
  groupSize: 7,
  navigate: (anchor, direction) => addDays(anchor, direction === 'previous' ? -7 : 7),
  buildInitial: buildInitialDayPeriods,
  shiftWindow: shiftDayPeriodWindow,
  formatLabel: period => dayLabelFormatter.format(period.start),
};
