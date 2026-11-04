import { dateOfBirthSchema } from '../../src/validation/dateOfBirth';
import { createLeadSchema, signUpLeadSchema, updateLeadSchema } from '../../src/validation/leadSchemas';
import { publicLeadSchema } from '../../src/validation/publicSchemas';

describe('Lead date of birth validation', () => {
  afterEach(() => jest.useRealTimers());

  it('uses the Toronto date and accepts past DOBs regardless of age', () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-10-29T02:00:00Z'));

    expect(dateOfBirthSchema.safeParse('2026-10-28').success).toBe(false);
    expect(dateOfBirthSchema.safeParse('2026-10-27').success).toBe(true);
    expect(dateOfBirthSchema.safeParse('1980-01-01').success).toBe(true);
  });

  it.each(['2012-02-30', '2011-02-29', '0000-01-01', '2012-2-02', '', '2099-01-01'])(
    'rejects impossible, malformed, or future DOB %s', dateOfBirth => {
      expect(dateOfBirthSchema.safeParse(dateOfBirth).success).toBe(false);
    },
  );

  it('accepts real leap-day birth dates', () => {
    expect(dateOfBirthSchema.safeParse('2012-02-29').success).toBe(true);
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

  it('allows profile signup outside program age bounds when no program cycle is selected', () => {
    const params = { id: '00000000-0000-4000-8000-000000000001' };
    expect(signUpLeadSchema.safeParse({ params, body: { dateOfBirth: '2000-01-01' } }).success).toBe(true);
    expect(signUpLeadSchema.safeParse({ params, body: { age: 14 } }).success).toBe(false);
  });
});
