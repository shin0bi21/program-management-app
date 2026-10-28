import type { DateRangePreset } from '../../../components/FilterCard/types';
import type { ProgramCycle } from './types';

const DAY_IN_MS = 86_400_000;

export function getDateRangePresets(today: string, cycles: ProgramCycle[]): DateRangePreset[] {
  const year = today.slice(0, 4);
  const monthStart = `${today.slice(0, 7)}-01`;
  const nextMonth = new Date(`${monthStart}T00:00:00Z`);
  nextMonth.setUTCMonth(nextMonth.getUTCMonth() + 1);
  nextMonth.setUTCDate(0);

  const presets: DateRangePreset[] = [
    { id: 'this-month', label: 'This Month', range: { start: monthStart, end: nextMonth.toISOString().slice(0, 10) } },
    { id: 'this-year', label: 'This Year', range: { start: `${year}-01-01`, end: `${year}-12-31` } },
  ];
  const currentCycles = cycles.filter(cycle => cycle.startsOn <= today && cycle.endsOn >= today);
  if (currentCycles.length === 1) {
    const currentCycle = currentCycles[0];
    presets.push({
      id: 'current-cycle', label: 'Current Cycle',
      range: { start: currentCycle.startsOn, end: currentCycle.endsOn },
    });
  }

  // Hours anchors payroll blocks to the most recently started cycle, even after it ends.
  const payCycle = cycles.filter(cycle => cycle.startsOn <= today)
    .sort((a, b) => b.startsOn.localeCompare(a.startsOn) || a.id.localeCompare(b.id))[0];
  if (payCycle) {
    const anchor = Date.parse(`${payCycle.startsOn}T00:00:00Z`);
    const elapsedDays = Math.floor((Date.parse(`${today}T00:00:00Z`) - anchor) / DAY_IN_MS);
    const start = anchor + Math.floor(elapsedDays / 14) * 14 * DAY_IN_MS;
    presets.push({
      id: 'current-pay-period', label: 'Current Pay Period',
      range: {
        start: new Date(start).toISOString().slice(0, 10),
        end: new Date(start + 13 * DAY_IN_MS).toISOString().slice(0, 10),
      },
    });
  }
  return presets;
}
