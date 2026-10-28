// @vitest-environment node

import { describe, expect, it } from 'vitest';
import { calculateOutreachAge, getOutreachDateOfBirthBounds } from './dateOfBirth';

describe('outreach birth dates', () => {
  it('counts completed years across birthdays and leap days', () => {
    expect(calculateOutreachAge('2012-10-29', '2026-10-28')).toBe(13);
    expect(calculateOutreachAge('2012-10-29', '2026-10-29')).toBe(14);
    expect(calculateOutreachAge('2012-02-29', '2026-02-28')).toBe(13);
    expect(calculateOutreachAge('2012-02-29', '2026-03-01')).toBe(14);
  });

  it.each(['', '2012-02-30', '2011-02-29', '2012-13-01', '0000-01-01', '12/01/2012'])('rejects invalid calendar date %s', date => {
    expect(calculateOutreachAge(date, '2026-10-28')).toBeNull();
  });

  it('provides inclusive intake bounds for ages 12 through 19', () => {
    expect(getOutreachDateOfBirthBounds('2026-10-28')).toEqual({ min: '2006-10-29', max: '2014-10-28' });
    expect(getOutreachDateOfBirthBounds('2028-02-29')).toEqual({ min: '2008-03-01', max: '2016-02-29' });
  });
});
