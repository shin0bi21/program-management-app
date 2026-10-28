import { z } from 'zod';
import { leadIntakeDateOfBirthSchema } from './leadDateOfBirth';

const optionalTrimmedString = (max: number, tooLongMessage: string) =>
  z.string().trim().max(max, tooLongMessage).optional().or(z.literal(''));

export const publicLeadSchema = z.object({
  body: z.object({
    youthFirstName: z.string().trim().min(1, 'Youth first name is required').max(120, 'Youth first name is too long'),
    youthLastName: z.string().trim().min(1, 'Youth last name is required').max(120, 'Youth last name is too long'),
    dateOfBirth: leadIntakeDateOfBirthSchema,
    school: z.string().trim().min(1, 'School is required').max(255, 'School is too long'),
    submittedByRole: z.enum(['youth', 'parent', 'guardian'], { error: 'Submitter is required' }),
    discoverySource: z.enum(['online', 'friend_family', 'school', 'community_outreach', 'other'], {
      error: 'Discovery source is required',
    }),
    contactPhoneNumber: z.string().trim().min(1, 'Contact phone number is required').max(40, 'Contact phone number is too long'),
    contactRelationship: z.enum(['parent', 'sibling', 'guardian'], {
      error: 'Contact relationship is required',
    }),
    notes: optionalTrimmedString(500, 'Intake information must be 500 characters or fewer'),
    website: z.literal('').optional(),
  }).strict(),
});
