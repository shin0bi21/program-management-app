import { describe, expect, it } from 'vitest';
import { buildDayPeriod, addDays } from '../periods';
import { layoutRangeItems } from './rangeLayout';

describe('range layout', () => {
  const periods = Array.from(
    { length: 7 },
    (_, index) => buildDayPeriod(addDays(new Date(2026, 7, 9), index)),
  );

  it('gives overlapping ranges separate lanes and grows their resource row', () => {
    const items = Array.from({ length: 4 }, (_, index) => ({
      id: `task-${index}`,
      start: '2026-08-09',
      end: '2026-08-12',
    }));
    const layout = layoutRangeItems(items, periods, item => ({ start: item.start, end: item.end }));

    expect(layout.map(item => item.lane)).toEqual([0, 1, 2, 3]);
  });

  it('reuses lanes when ranges do not overlap', () => {
    const layout = layoutRangeItems([
      { start: '2026-08-09', end: '2026-08-10' },
      { start: '2026-08-11', end: '2026-08-12' },
    ], periods, item => item);

    expect(layout.map(item => item.lane)).toEqual([0, 0]);
  });
});
