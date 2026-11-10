// @vitest-environment node

import { afterEach, describe, expect, it, vi } from 'vitest';
import { calculateAge, getDateOfBirthBounds, dateOfBirthSchema } from './dateOfBirth';

describe('youth birth dates', () => {
  afterEach(() => vi.useRealTimers());

  it.each(['1980-01-01', '2014-10-29', '2012-02-29', '2026-10-27'])(
    'accepts any real past birthdate %s without intake age limits', date => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2026-10-29T02:00:00Z'));

      expect(dateOfBirthSchema.safeParse(date).success).toBe(true);
    },
  );

  it.each(['', '0000-01-01', '2012-02-30', '2026-10-28', '2026-10-29'])(
    'rejects missing, invalid, today, or future DOB %s', date => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2026-10-29T02:00:00Z'));

      expect(dateOfBirthSchema.safeParse(date).success).toBe(false);
    },
  );

  it('counts completed years across birthdays and leap days', () => {
    expect(calculateAge('2012-10-29', '2026-10-28')).toBe(13);
    expect(calculateAge('2012-10-29', '2026-10-29')).toBe(14);
    expect(calculateAge('2012-02-29', '2026-02-28')).toBe(13);
    expect(calculateAge('2012-02-29', '2026-03-01')).toBe(14);
  });

  it.each(['', '2012-02-30', '2011-02-29', '2012-13-01', '0000-01-01', '12/01/2012'])('rejects invalid calendar date %s', date => {
    expect(calculateAge(date, '2026-10-28')).toBeNull();
  });

  it('bounds native dates at yesterday in Toronto without a minimum age', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-03-01T02:00:00Z'));

    expect(getDateOfBirthBounds()).toEqual({ max: '2026-02-27' });
    expect(getDateOfBirthBounds('2026-10-28')).toEqual({ max: '2026-10-27' });
    expect(getDateOfBirthBounds('2028-03-01')).toEqual({ max: '2028-02-29' });
  });
});
