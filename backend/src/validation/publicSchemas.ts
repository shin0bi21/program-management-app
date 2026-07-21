import { z } from 'zod';

const optionalTrimmedString = (max: number, tooLongMessage: string) =>
  z.string().trim().max(max, tooLongMessage).optional().or(z.literal(''));

export const expressionOfInterestSchema = z.object({
  body: z.object({
    youthFirstName: z.string().trim().min(1, 'Youth first name is required').max(120, 'Youth first name is too long'),
    youthLastName: z.string().trim().min(1, 'Youth last name is required').max(120, 'Youth last name is too long'),
    age: z.coerce.number().int('Age must be a whole number').min(5, 'Age must be 5 or higher').max(24, 'Age must be 24 or lower'),
    school: z.string().trim().min(1, 'School is required').max(255, 'School is too long'),
    discoverySource: z.enum(['online', 'friend_family', 'school', 'community_outreach', 'other'], {
      error: 'Discovery source is required',
    }),
    contactFirstName: z.string().trim().min(1, 'Contact first name is required').max(120, 'Contact first name is too long'),
    contactLastName: z.string().trim().min(1, 'Contact last name is required').max(120, 'Contact last name is too long'),
    contactPhoneNumber: z.string().trim().min(1, 'Contact phone number is required').max(40, 'Contact phone number is too long'),
    contactRelationship: z.enum(['parent', 'sibling', 'guardian'], {
      error: 'Contact relationship is required',
    }),
    notes: optionalTrimmedString(5000, 'Notes must be 5000 characters or fewer'),
  }),
});
