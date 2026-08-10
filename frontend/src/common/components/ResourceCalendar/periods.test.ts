import { describe, expect, it } from 'vitest';
import { addDays, buildDayPeriod, buildInitialDayPeriods, dayKey, extendDayPeriods, shiftDayPeriodWindow } from './periods';

describe('day periods', () => {
  it.each([
    new Date(2026, 2, 8),
    new Date(2026, 10, 1),
  ])('ends the local day at the following midnight across DST transitions', date => {
    const period = buildDayPeriod(date);
    const followingDay = addDays(date, 1);

    expect(dayKey(period.end)).toBe(dayKey(followingDay));
    expect(period.end.getHours()).toBe(0);
  });

  it('builds a stable range centered on the requested day', () => {
    const periods = buildInitialDayPeriods(new Date(2026, 7, 9), 5);

    expect(periods.map(period => period.key)).toEqual([
      '2026-08-07',
      '2026-08-08',
      '2026-08-09',
      '2026-08-10',
      '2026-08-11',
    ]);
  });

  it('extends without duplicating either edge period', () => {
    const periods = buildInitialDayPeriods(new Date(2026, 7, 9), 3);

    expect(extendDayPeriods(periods, 'left', 2).map(period => period.key)).toEqual([
      '2026-08-06',
      '2026-08-07',
    ]);
    expect(extendDayPeriods(periods, 'right', 2).map(period => period.key)).toEqual([
      '2026-08-11',
      '2026-08-12',
    ]);
  });

  it('uses local calendar dates for period keys', () => {
    expect(dayKey(new Date(2026, 11, 31, 23, 30))).toBe('2026-12-31');
  });

  it('keeps a bounded rendered window while shifting in either direction', () => {
    const initial = buildInitialDayPeriods(new Date(2026, 7, 9), 5);
    const right = shiftDayPeriodWindow(initial, 'right', 2, 5);
    const left = shiftDayPeriodWindow(right.periods, 'left', 2, 5);

    expect(right.periods.map(period => period.key)).toEqual([
      '2026-08-09', '2026-08-10', '2026-08-11', '2026-08-12', '2026-08-13',
    ]);
    expect(left.periods.map(period => period.key)).toEqual(initial.map(period => period.key));
  });
});
