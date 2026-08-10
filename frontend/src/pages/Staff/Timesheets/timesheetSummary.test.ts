import { Temporal } from 'temporal-polyfill';
import { describe, expect, it } from 'vitest';
import { summarizeCycleHours } from './timesheetSummary';

describe('summarizeCycleHours', () => {
  it('anchors fourteen-day pay periods to the cycle start across month boundaries', () => {
    const result = summarizeCycleHours([
      { date: '2026-03-13', label: 'Program Delivery', hours: 2 },
      { date: '2026-03-14', label: 'Planning', hours: 3 },
    ], { startsOn: '2026-03-01', endsOn: '2026-05-31' }, Temporal.PlainDate.from('2026-03-15'));

    expect(result).toEqual(expect.objectContaining({
      periodStart: '2026-03-15',
      periodEnd: '2026-03-28',
      periodTotal: 0,
      average: 2.5,
      periodCount: 2,
    }));
  });

  it('clamps the final partial pay period to the cycle end', () => {
    const result = summarizeCycleHours(
      [{ date: '2027-01-31', label: 'Program Delivery', hours: 4 }],
      { startsOn: '2026-09-01', endsOn: '2027-01-31' },
      Temporal.PlainDate.from('2027-02-10'),
    );

    expect(result.periodEnd).toBe('2027-01-31');
    expect(result.periodTotal).toBe(4);
  });
});
