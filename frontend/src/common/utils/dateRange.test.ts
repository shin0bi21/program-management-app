// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { intersectDateRanges, isDateRange } from './dateRange';
import { preferenceDateRange } from '../features/Preferences/preferences';

describe('date ranges', () => {
  it('accepts real inclusive ranges and repairs invalid saved dates', () => {
    const fallback = { start: '2026-01-01', end: '2026-12-31' };
    expect(isDateRange({ start: '2028-02-29', end: '2028-02-29' })).toBe(true);
    for (const value of [null, { start: '2026-02-29', end: '2026-03-01' }, { start: '2026-12-31', end: '2026-01-01' }]) {
      expect(isDateRange(value)).toBe(false);
      expect(preferenceDateRange(fallback)(value)).toEqual(fallback);
    }
  });

  it('clips buffered loads without widening the applied range', () => {
    const bounds = { start: '2026-03-01', end: '2026-03-31' };
    expect(intersectDateRanges({ start: '2026-02-01', end: '2026-04-01' }, bounds)).toEqual(bounds);
    expect(intersectDateRanges({ start: '2026-03-31', end: '2026-04-01' }, bounds)).toEqual({ start: '2026-03-31', end: '2026-03-31' });
    expect(intersectDateRanges({ start: '2026-04-01', end: '2026-04-30' }, bounds)).toBeNull();
  });
  it('accepts 366 inclusive days, including leap years, and rejects a 367th day', () => {
    expect(isDateRange({ start: '2028-01-01', end: '2028-12-31' })).toBe(true);
    expect(isDateRange({ start: '2028-01-01', end: '2029-01-01' })).toBe(false);
    const fallback = { start: '2026-01-01', end: '2026-12-31' };
    expect(preferenceDateRange(fallback)({ start: '1000-01-01', end: '9999-12-31' })).toEqual(fallback);
  });

  it('supports real calendar years from 0001 and rejects year zero', () => {
    expect(isDateRange({ start: '0001-01-01', end: '0001-12-31' })).toBe(true);
    expect(isDateRange({ start: '0099-01-01', end: '0099-12-31' })).toBe(true);
    expect(isDateRange({ start: '0000-01-01', end: '0000-01-02' })).toBe(false);
  });

});
