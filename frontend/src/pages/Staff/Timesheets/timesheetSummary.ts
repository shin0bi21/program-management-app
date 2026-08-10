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

const PAY_PERIOD_ANCHOR = Temporal.PlainDate.from('2026-07-29');

export function summarizeCycleHours(
  entries: SummaryEntry[],
  cycle: SummaryCycle | null,
  today = Temporal.Now.plainDateISO(),
  payPeriodEntries = entries,
) {
  const elapsedPayPeriodDays = PAY_PERIOD_ANCHOR.until(today, { largestUnit: 'days' }).days;
  const payPeriodIndex = Math.floor(elapsedPayPeriodDays / 14);
  const periodStart = PAY_PERIOD_ANCHOR.add({ days: payPeriodIndex * 14 });
  const periodEnd = periodStart.add({ days: 13 });
  const periodTaskHours = new Map<string, number>();
  let periodTotal = 0;
  for (const entry of payPeriodEntries) {
    const date = Temporal.PlainDate.from(entry.date);
    if (Temporal.PlainDate.compare(date, periodStart) >= 0 && Temporal.PlainDate.compare(date, periodEnd) <= 0) {
      periodTotal += entry.hours;
      periodTaskHours.set(entry.label, (periodTaskHours.get(entry.label) ?? 0) + entry.hours);
    }
  }
  const byHours = (left: [string, number], right: [string, number]) => right[1] - left[1];
  if (!cycle) {
    return {
      periodTotal, average: 0, periodCount: 1,
      periodStart: periodStart.toString(), periodEnd: periodEnd.toString(),
      taskHours: [], periodTaskHours: [...periodTaskHours.entries()].sort(byHours),
    };
  }
  const cycleStart = Temporal.PlainDate.from(cycle.startsOn);
  const cycleEnd = Temporal.PlainDate.from(cycle.endsOn);
  const effectiveDate = Temporal.PlainDate.compare(today, cycleStart) < 0
    ? cycleStart
    : Temporal.PlainDate.compare(today, cycleEnd) > 0 ? cycleEnd : today;
  const elapsedCycleDays = cycleStart.until(effectiveDate, { largestUnit: 'days' }).days;
  const periodCount = Math.max(1, Math.floor(elapsedCycleDays / 14) + 1);
  const taskHours = new Map<string, number>();
  let cycleTotal = 0;
  for (const entry of entries) {
    cycleTotal += entry.hours;
    taskHours.set(entry.label, (taskHours.get(entry.label) ?? 0) + entry.hours);
  }
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
