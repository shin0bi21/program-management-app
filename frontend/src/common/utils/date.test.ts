import { describe, expect, it } from 'vitest';
import { formatShortDate } from './date';

describe('formatShortDate', () => {
  it('formats timestamps using the shared short-date style', () => {
    expect(formatShortDate('2026-07-20T12:00:00Z')).toBe('Jul 20, 2026');
  });

  it('accepts Date instances', () => {
    expect(formatShortDate(new Date('2026-01-05T12:00:00Z'))).toBe('Jan 5, 2026');
  });
});
