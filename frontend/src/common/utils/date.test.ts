// @vitest-environment node
import { afterEach, describe, expect, it, vi } from 'vitest';
import { formatHours, formatShortDate, formatShortDateRange, getDate } from './date';

describe('formatHours', () => {
  it('formats and pluralizes hour durations', () => {
    expect(formatHours(1)).toBe('1 hour');
    expect(formatHours(1.5)).toBe('1.5 hours');
    expect(formatHours(2.345)).toBe('2.35 hours');
  });
});

describe('formatShortDate', () => {
  it('formats timestamps using the shared short-date style', () => {
    expect(formatShortDate('2026-07-20T12:00:00Z')).toBe('Jul 20, 2026');
  });

  it('accepts Date instances', () => {
    expect(formatShortDate(new Date('2026-01-05T12:00:00Z'))).toBe('Jan 5, 2026');
  });

  it('shows event dates in program Eastern time across the UTC date boundary', () => {
    expect(formatShortDate('2026-08-07T02:30:00Z')).toBe('Aug 6, 2026');
  });

  it('keeps date-only values on their calendar day', () => {
    expect(formatShortDate('2026-07-01')).toBe('Jul 1, 2026');
  });

  it('preserves business-date years below 100', () => {
    expect(formatShortDate('0001-01-01')).toBe('Jan 1, 1');
    expect(formatShortDateRange('0099-12-30', '0100-01-02')).toBe('Dec 30, 99 – Jan 2, 100');
  });
});

describe('formatShortDateRange', () => {
  it('collapses repeated month and year information', () => {
    expect(formatShortDateRange('2026-07-29', '2026-08-11')).toBe('Jul 29 – Aug 11, 2026');
  });
});

describe('getDate', () => {
  afterEach(() => vi.useRealTimers());

  it.each([
    [2026, 9, 28, '2026-10-28', '2026-10-27'],
    [2028, 2, 1, '2028-03-01', '2028-02-29'],
  ] as const)('offsets local calendar days from %s/%s/%s', (year, month, day, today, yesterday) => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(year, month, day, 12));

    expect(getDate()).toBe(today);
    expect(getDate(-1)).toBe(yesterday);
  });
});
