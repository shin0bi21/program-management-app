import type { CalendarPeriod, PeriodDefinition } from '../types';

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

const dayLabelFormatter = new Intl.DateTimeFormat('en-CA', {
  weekday: 'short', month: 'short', day: 'numeric',
});

export const dayPeriodDefinition: PeriodDefinition = {
  navigate: (anchor, direction) => addDays(anchor, direction === 'previous' ? -7 : 7),
  buildInitial: buildInitialDayPeriods,
  formatLabel: period => dayLabelFormatter.format(period.start),
};
