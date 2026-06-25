import { z } from 'zod';

const optionalTrimmedString = (max: number, tooLongMessage: string) =>
  z.string().trim().max(max, tooLongMessage).optional().or(z.literal(''));

export const cohortInterestSchema = z.object({
  body: z.object({
    youthName: z.string().trim().min(1, 'Youth name is required').max(160, 'Youth name is too long'),
    parentName: optionalTrimmedString(160, 'Parent name is too long'),
    age: z.coerce.number().int('Age must be a whole number').min(1, 'Age is required').max(120, 'Age must be realistic'),
    school: optionalTrimmedString(160, 'School is too long'),
    email: z.string().trim().email('Invalid email address').optional().or(z.literal('')),
    phoneNumber: optionalTrimmedString(30, 'Phone number is too long'),
    discoverySource: z.enum(['online', 'friend_family', 'school', 'community_outreach', 'other']).optional().or(z.literal('')),
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
