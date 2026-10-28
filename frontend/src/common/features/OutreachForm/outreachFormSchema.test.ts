// @vitest-environment node

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { outreachFormSchema } from './outreachFormSchema';

const validForm = {
  youthFirstName: 'Avery',
  youthLastName: 'Outreach',
  dateOfBirth: '2012-10-28',
  school: 'Test School',
  programId: '',
  contactPhoneNumber: '416-555-0142',
  contactRelationship: 'parent' as const,
  discoverySource: 'online' as const,
  notes: '',
};

describe('outreachFormSchema', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-10-29T02:00:00Z'));
  });
  afterEach(() => vi.useRealTimers());

  it.each(['2014-10-28', '2011-10-28', '2006-10-29'])('accepts eligible date %s on the Toronto date', dateOfBirth => {
    expect(outreachFormSchema.safeParse({ ...validForm, dateOfBirth }).success).toBe(true);
  });

  it.each(['', '2014-10-29', '2006-10-28', '2012-02-30', '2027-01-01'])('rejects missing, invalid or ineligible date %s', dateOfBirth => {
    const result = outreachFormSchema.safeParse({ ...validForm, dateOfBirth });
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error.issues[0].path).toEqual(['dateOfBirth']);
  });
});
