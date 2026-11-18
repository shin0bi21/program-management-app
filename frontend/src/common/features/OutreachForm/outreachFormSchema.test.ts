// @vitest-environment node
// Scope: intake owns the required past-birthdate rule composed by profile and signup forms.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { outreachFormSchema } from './outreachFormSchema';

describe('outreach birthdate field', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 9, 28, 12));
  });

  afterEach(() => vi.useRealTimers());

  it.each(['1980-01-01', '2026-10-27'])('accepts past birthdate %s without intake age limits', date => {
    expect(outreachFormSchema.shape.dateOfBirth.safeParse(date).success).toBe(true);
  });

  it.each([
    ['', 'Date of birth is required'],
    ['2026-10-28', 'Date of birth must be before today'],
    ['2026-10-29', 'Date of birth must be before today'],
  ])('rejects %s with its field message', (date, message) => {
    expect(() => outreachFormSchema.shape.dateOfBirth.parse(date)).toThrow(message);
  });
});
