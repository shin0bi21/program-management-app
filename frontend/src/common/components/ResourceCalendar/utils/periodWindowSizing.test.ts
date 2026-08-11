import { describe, expect, it } from 'vitest';
import { calculateGroupedPeriodWindow, calculateVisiblePeriodCount } from './periodWindowSizing';

describe('period window sizing', () => {
  it('rounds visible periods to a complete group and adds one group on each side', () => {
    expect(calculateGroupedPeriodWindow(10, 7)).toBe(28);
    expect(calculateGroupedPeriodWindow(14, 7)).toBe(28);
    expect(calculateGroupedPeriodWindow(15, 7)).toBe(35);
  });

  it('calculates visible periods after excluding the covered resource column', () => {
    expect(calculateVisiblePeriodCount(190 + 10 * 152, 190, 152)).toBe(10);
  });
});
