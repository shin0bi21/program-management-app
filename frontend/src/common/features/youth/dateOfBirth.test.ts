// @vitest-environment node

import { afterEach, describe, expect, it, vi } from 'vitest';
import { getDateOfBirthBounds, dateOfBirthSchema } from './dateOfBirth';

describe('youth birth dates', () => {
  afterEach(() => vi.useRealTimers());

  it.each(['1980-01-01', '2014-10-29', '2012-02-29', '2026-10-27'])(
    'accepts any real past birthdate %s without intake age limits', date => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date(2026, 9, 28, 22));

      expect(dateOfBirthSchema.safeParse(date).success).toBe(true);
    },
  );

  it.each(['', '0000-01-01', '2012-02-30', '2026-10-28', '2026-10-29'])(
    'rejects missing, invalid, today, or future DOB %s', date => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date(2026, 9, 28, 22));

      expect(dateOfBirthSchema.safeParse(date).success).toBe(false);
    },
  );

  it('bounds native dates at local yesterday without a minimum age', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 1, 28, 21));

    expect(getDateOfBirthBounds()).toEqual({ max: '2026-02-27' });
    expect(getDateOfBirthBounds('2026-10-28')).toEqual({ max: '2026-10-27' });
    expect(getDateOfBirthBounds('2028-03-01')).toEqual({ max: '2028-02-29' });
  });
});
