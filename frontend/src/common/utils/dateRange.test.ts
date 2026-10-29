// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { intersectDateRanges, isDateRange } from './dateRange';

describe('date ranges', () => {
  it('accepts real inclusive ranges and rejects invalid dates', () => {
    expect(isDateRange({ start: '2028-02-29', end: '2028-02-29' })).toBe(true);
    for (const value of [null, { start: '2026-02-29', end: '2026-03-01' }, { start: '2026-12-31', end: '2026-01-01' }]) {
      expect(isDateRange(value)).toBe(false);
    }
  });

  it('clips buffered loads without widening the applied range', () => {
    const bounds = { start: '2026-03-01', end: '2026-03-31' };
    expect(intersectDateRanges({ start: '2026-02-01', end: '2026-04-01' }, bounds)).toEqual(bounds);
    expect(intersectDateRanges({ start: '2026-03-31', end: '2026-04-01' }, bounds)).toEqual({ start: '2026-03-31', end: '2026-03-31' });
    expect(intersectDateRanges({ start: '2026-04-01', end: '2026-04-30' }, bounds)).toBeNull();
  });
  it('accepts the full span across multiple years', () => {
    expect(isDateRange({ start: '2028-01-01', end: '2030-12-31' })).toBe(true);
  });

  it('supports real calendar years from 0001 and rejects year zero', () => {
    expect(isDateRange({ start: '0001-01-01', end: '0001-12-31' })).toBe(true);
    expect(isDateRange({ start: '0099-01-01', end: '0099-12-31' })).toBe(true);
    expect(isDateRange({ start: '0000-01-01', end: '0000-01-02' })).toBe(false);
  });

});
