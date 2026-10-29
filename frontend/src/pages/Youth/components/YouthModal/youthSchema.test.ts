// @vitest-environment node
import { afterEach, describe, expect, it, vi } from 'vitest';
import { getDateOfBirthBounds } from '../../../../common/features/youth/dateOfBirth';
import { youthSchema } from './youthSchema';

const profile = { firstName: 'Jamie', lastName: 'Test', email: '' };

describe('Youth birthdate validation', () => {
  afterEach(() => vi.useRealTimers());

  it.each([undefined, null, '', 'not-a-date', '0000-01-01', '2012-02-30', '2026-10-28', '2026-10-29'])(
    'rejects missing, invalid, today, or future birthdate %s', dateOfBirth => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2026-10-28T16:00:00Z'));

      expect(youthSchema.safeParse({ ...profile, dateOfBirth }).success).toBe(false);
    },
  );

  it.each(['2012-02-29', '1980-01-01', '2026-10-27'])(
    'accepts a real past date without an intake age limit: %s', dateOfBirth => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2026-10-28T16:00:00Z'));

      expect(youthSchema.safeParse({ ...profile, dateOfBirth }).success).toBe(true);
    },
  );

  it('uses Toronto today and the previous calendar day for the native maximum', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-03-01T02:00:00Z'));

    expect(getDateOfBirthBounds().max).toBe('2026-02-27');
    expect(youthSchema.safeParse({ ...profile, dateOfBirth: '2026-02-28' }).success).toBe(false);
    expect(youthSchema.safeParse({ ...profile, dateOfBirth: '2026-02-27' }).success).toBe(true);
  });
});
