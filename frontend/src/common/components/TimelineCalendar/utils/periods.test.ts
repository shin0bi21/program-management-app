// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { buildInitialDayPeriods } from './periods';

describe('day periods', () => {
  it('builds a date-only range centered on the requested day', () => {
    const periods = buildInitialDayPeriods('2026-08-09', 5);
    expect(periods.map(period => period.key)).toEqual([
      '2026-08-07', '2026-08-08', '2026-08-09', '2026-08-10', '2026-08-11',
    ]);
  });
});
