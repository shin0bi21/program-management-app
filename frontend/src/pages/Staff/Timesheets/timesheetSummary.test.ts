import { Temporal } from 'temporal-polyfill';
import { describe, expect, it } from 'vitest';
import { summarizeCycleHours } from './timesheetSummary';

describe('summarizeCycleHours', () => {
  it('uses the organization pay-period calendar independently of the cycle start', () => {
    const result = summarizeCycleHours([
      { date: '2026-07-28', label: 'Planning', hours: 3 },
      { date: '2026-07-29', label: 'Program Delivery', hours: 2 },
      { date: '2026-08-11', label: 'Planning', hours: 1 },
    ], { startsOn: '2026-02-01', endsOn: '2026-08-11' }, Temporal.PlainDate.from('2026-08-10'));

    expect(result).toEqual(expect.objectContaining({
      periodStart: '2026-07-29',
      periodEnd: '2026-08-11',
      periodTotal: 3,
      periodCount: 14,
    }));
  });

  it('calculates matching pay periods before the anchor date', () => {
    const result = summarizeCycleHours(
      [{ date: '2026-03-11', label: 'Program Delivery', hours: 4 }],
      { startsOn: '2026-03-01', endsOn: '2026-05-31' },
      Temporal.PlainDate.from('2026-03-15'),
    );

    expect(result.periodStart).toBe('2026-03-11');
    expect(result.periodEnd).toBe('2026-03-24');
    expect(result.periodTotal).toBe(4);
  });
});
