import { leadAge, leadDateOfBirthSchema, leadIntakeDateOfBirthSchema } from '../../src/validation/leadDateOfBirth';
import { createLeadSchema, signUpLeadSchema, updateLeadSchema } from '../../src/validation/leadSchemas';
import { publicLeadSchema } from '../../src/validation/publicSchemas';

describe('Lead date of birth validation', () => {
  afterEach(() => jest.useRealTimers());

  it('uses the Toronto birthday and accepts both intake age boundaries', () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-10-29T02:00:00Z'));

    expect(leadAge('2014-10-28')).toBe(12);
    expect(leadAge('2014-10-29')).toBe(11);
    expect(leadIntakeDateOfBirthSchema.safeParse('2014-10-28').success).toBe(true);
    expect(leadIntakeDateOfBirthSchema.safeParse('2006-10-29').success).toBe(true);
    expect(leadIntakeDateOfBirthSchema.safeParse('2014-10-29').success).toBe(false);
    expect(leadIntakeDateOfBirthSchema.safeParse('2006-10-28').success).toBe(false);
  });

  it.each(['2012-02-30', '2011-02-29', '0000-01-01', '2012-2-02', '', '2099-01-01'])(
    'rejects impossible, malformed, or future DOB %s', dateOfBirth => {
      expect(leadDateOfBirthSchema.safeParse(dateOfBirth).success).toBe(false);
    },
  );

  it('handles leap-day birthdays as calendar dates', () => {
    expect(leadAge('2012-02-29', '2026-02-28')).toBe(13);
    expect(leadAge('2012-02-29', '2026-03-01')).toBe(14);
  });

  it('requires DOB on all intake forms and rejects obsolete age inputs', () => {
    const body = {
      youthFirstName: 'Test', youthLastName: 'Youth', school: 'Test School',
      contactPhoneNumber: '416-555-0101', contactRelationship: 'parent', discoverySource: 'online',
    };
    for (const schema of [createLeadSchema, updateLeadSchema, publicLeadSchema]) {
      const data = { params: { id: '00000000-0000-4000-8000-000000000001' }, body: { ...body, submittedByRole: 'parent' } };
      if (schema !== publicLeadSchema) delete (data.body as Partial<typeof data.body>).submittedByRole;
      expect(schema.safeParse(data).success).toBe(false);
      expect(schema.safeParse({ ...data, body: { ...data.body, dateOfBirth: '2012-01-01', age: 14 } }).success).toBe(false);
    }
  });

  it('allows signup DOB correction beyond the intake age range', () => {
    const params = { id: '00000000-0000-4000-8000-000000000001' };
    expect(signUpLeadSchema.safeParse({ params, body: { dateOfBirth: '2000-01-01' } }).success).toBe(true);
    expect(signUpLeadSchema.safeParse({ params, body: { age: 14 } }).success).toBe(false);
  });
});
