import { z } from 'zod';

const optionalTrimmedString = (max: number, tooLongMessage: string) =>
  z.string().trim().max(max, tooLongMessage).optional().or(z.literal(''));

export const cohortInterestSchema = z.object({
  body: z.object({
    youthFirstName: z.string().trim().min(1, 'Youth first name is required').max(80, 'Youth first name is too long'),
    youthLastName: z.string().trim().min(1, 'Youth last name is required').max(80, 'Youth last name is too long'),
    age: z.coerce.number().int('Age must be a whole number').min(1, 'Age is required').max(120, 'Age must be realistic'),
    school: z.string().trim().min(1, 'School is required').max(160, 'School is too long'),
    email: z.string().trim().email('Invalid email address').optional().or(z.literal('')),
    phoneNumber: optionalTrimmedString(30, 'Phone number is too long'),
    discoverySource: z.enum(['online', 'friend_family', 'school', 'community_outreach', 'other'], {
      error: 'Discovery source is required',
    }),
    contactFirstName: z.string().trim().min(1, 'Contact first name is required').max(80, 'Contact first name is too long'),
    contactLastName: z.string().trim().min(1, 'Contact last name is required').max(80, 'Contact last name is too long'),
    contactPhoneNumber: z.string().trim().min(1, 'Contact phone number is required').max(30, 'Contact phone number is too long'),
    contactRelationship: z.enum(['parent', 'sibling', 'guardian', 'emergency'], {
      error: 'Contact relationship is required',
    }),
    message: optionalTrimmedString(1000, 'Message must be 1000 characters or fewer'),
  }).superRefine((data, ctx) => {
    const hasEmail = Boolean(data.email?.trim());
    const hasPhone = Boolean(data.phoneNumber?.trim());

    if (!hasEmail && !hasPhone) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['email'],
        message: 'Provide an email or phone number',
      });
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['phoneNumber'],
        message: 'Provide an email or phone number',
      });
    }
  }),
});
