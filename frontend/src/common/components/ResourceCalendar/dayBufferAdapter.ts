import { addDays, buildDayPeriod } from './periods';
import type { PeriodBufferAdapter } from './PeriodDataBuffer';

const DAY_MS = 24 * 60 * 60 * 1000;

export const dayBufferAdapter: PeriodBufferAdapter = {
  shift: (period, amount) => buildDayPeriod(addDays(period.start, amount)),
  distance: (start, end) => Math.round((end.start.getTime() - start.start.getTime()) / DAY_MS),
  includes: (start, end, periodKey) => periodKey >= start.key && periodKey <= end.key,
  targetSize: 42,
  threshold: 21,
  replenishSize: 21,
};
