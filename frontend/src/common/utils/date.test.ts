import { describe, expect, it } from 'vitest';
import { formatShortDate, getDateKeyInTimeZone } from './date';

describe('formatShortDate', () => {
  it('formats timestamps using the shared short-date style', () => {
    expect(formatShortDate('2026-07-20T12:00:00Z')).toBe('Jul 20, 2026');
  });

  it('accepts Date instances', () => {
    expect(formatShortDate(new Date('2026-01-05T12:00:00Z'))).toBe('Jan 5, 2026');
  });

  it('keeps date-only values on their calendar day', () => {
    expect(formatShortDate('2026-07-01')).toBe('Jul 1, 2026');
  });
});

describe('getDateKeyInTimeZone', () => {
  it('uses the Toronto calendar day instead of UTC', () => {
    expect(getDateKeyInTimeZone(
      new Date('2026-08-07T02:30:00.000Z'),
      'America/Toronto',
    )).toBe('2026-08-06');
  });
});
