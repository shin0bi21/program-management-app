import { describe, expect, it } from 'vitest';
import { calculateAge, getAge } from './time';

describe('age utilities', () => {
  const today = new Date(2026, 6, 26);

  it('calculates age from date-only values without timezone shifts', () => {
    expect(getAge('2012-07-26', today)).toBe(14);
    expect(getAge('2012-07-27', today)).toBe(13);
  });

  it('returns an empty display value when a birth date is unavailable', () => {
    expect(getAge(null, today)).toBeNull();
    expect(calculateAge(null)).toBe('—');
  });
});
