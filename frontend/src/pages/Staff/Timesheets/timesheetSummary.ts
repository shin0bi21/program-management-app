import { Temporal } from 'temporal-polyfill';

interface SummaryEntry {
  date: string;
  label: string;
  hours: number;
}

interface SummaryCycle {
  startsOn: string;
  endsOn: string;
}

export function summarizeCycleHours(entries: SummaryEntry[], cycle: SummaryCycle | null, today = Temporal.Now.plainDateISO()) {
  if (!cycle) {
    return { periodTotal: 0, average: 0, periodCount: 1, periodStart: null, periodEnd: null, taskHours: [], periodTaskHours: [] };
  }
  const cycleStart = Temporal.PlainDate.from(cycle.startsOn);
  const cycleEnd = Temporal.PlainDate.from(cycle.endsOn);
  const effectiveDate = Temporal.PlainDate.compare(today, cycleStart) < 0
    ? cycleStart
    : Temporal.PlainDate.compare(today, cycleEnd) > 0 ? cycleEnd : today;
  const elapsedDays = cycleStart.until(effectiveDate, { largestUnit: 'days' }).days;
  const periodIndex = Math.max(0, Math.floor(elapsedDays / 14));
  const periodStart = cycleStart.add({ days: periodIndex * 14 });
  const candidateEnd = periodStart.add({ days: 13 });
  const periodEnd = Temporal.PlainDate.compare(candidateEnd, cycleEnd) > 0 ? cycleEnd : candidateEnd;
  const taskHours = new Map<string, number>();
  const periodTaskHours = new Map<string, number>();
  let cycleTotal = 0;
  let periodTotal = 0;
  for (const entry of entries) {
    cycleTotal += entry.hours;
    taskHours.set(entry.label, (taskHours.get(entry.label) ?? 0) + entry.hours);
    const date = Temporal.PlainDate.from(entry.date);
    if (Temporal.PlainDate.compare(date, periodStart) >= 0 && Temporal.PlainDate.compare(date, periodEnd) <= 0) {
      periodTotal += entry.hours;
      periodTaskHours.set(entry.label, (periodTaskHours.get(entry.label) ?? 0) + entry.hours);
    }
  }
  const periodCount = periodIndex + 1;
  const byHours = (left: [string, number], right: [string, number]) => right[1] - left[1];
  return {
    periodTotal,
    average: cycleTotal / periodCount,
    periodCount,
    periodStart: periodStart.toString(),
    periodEnd: periodEnd.toString(),
    taskHours: [...taskHours.entries()].sort(byHours),
    periodTaskHours: [...periodTaskHours.entries()].sort(byHours),
  };
}
