import { describe, expect, it } from 'vitest';
import { outreachFormSchema } from './outreachFormSchema';

const validForm = {
  youthFirstName: 'Avery',
  youthLastName: 'Outreach',
  age: 14,
  school: 'Test School',
  programId: '',
  contactPhoneNumber: '416-555-0142',
  contactRelationship: 'parent' as const,
  discoverySource: 'online' as const,
  notes: '',
};

describe('outreachFormSchema', () => {
  it.each([12, 15, 16, 19])('accepts supported age %i', (age) => {
    expect(outreachFormSchema.safeParse({ ...validForm, age }).success).toBe(true);
  });

  it.each([11, 20])('rejects unsupported age %i', (age) => {
    const result = outreachFormSchema.safeParse({ ...validForm, age });

    expect(result.success).toBe(false);
    if (!result.success) expect(result.error.issues[0].path).toEqual(['age']);
  });
});
