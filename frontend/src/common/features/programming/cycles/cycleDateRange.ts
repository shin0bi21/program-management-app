import type { DateRange } from '../../../utils/dateRange';
import type { ProgramCycle } from './types';

/** Uses every available cycle when no cycle IDs are selected; no matching cycles means no range. */
export function getCycleDateRange(cycles: readonly ProgramCycle[], cycleIds: readonly string[] = []): DateRange | undefined {
  const includedCycles = cycleIds.length
    ? cycles.filter(cycle => cycleIds.includes(cycle.id))
    : cycles;
  if (!includedCycles.length) return undefined;

  let start = includedCycles[0].startsOn;
  let end = includedCycles[0].endsOn;
  for (const cycle of includedCycles) {
    if (cycle.startsOn < start) start = cycle.startsOn;
    if (cycle.endsOn > end) end = cycle.endsOn;
  }
  return { start, end };
}
