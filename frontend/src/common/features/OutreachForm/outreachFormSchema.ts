import { z } from 'zod';
import { outreachDateOfBirthSchema } from './dateOfBirth';

const namePattern = /^[a-zA-Z\s'-]+$/;

export const outreachFormSchema = z.object({
  youthFirstName: z.string().trim().min(1, 'First name is required').regex(namePattern, 'Enter a valid first name'),
  youthLastName: z.string().trim().min(1, 'Last name is required').regex(namePattern, 'Enter a valid last name'),
  dateOfBirth: outreachDateOfBirthSchema,
  school: z.string().trim().min(1, 'School is required'),
  contactPhoneNumber: z.string().trim().min(1, 'Contact phone number is required'),
  contactRelationship: z.enum(['parent', 'guardian', 'sibling'], { error: 'Relationship is required' }),
  discoverySource: z.enum(['online', 'friend_family', 'school', 'community_outreach', 'other'], { error: 'Discovery source is required' }),
  notes: z.string().max(500, 'Intake information must be 500 characters or fewer'),
});

export type OutreachFormValues = z.infer<typeof outreachFormSchema>;

export const publicOutreachFormSchema = outreachFormSchema.extend({
  submittedByRole: z.enum(['youth', 'parent', 'guardian'], { error: 'Submitter is required' }),
  website: z.literal('').optional(),
});

export type PublicOutreachFormValues = z.infer<typeof publicOutreachFormSchema>;

export const outreachFormDefaultValues: OutreachFormValues = {
  youthFirstName: '',
  youthLastName: '',
  dateOfBirth: '',
  school: '',
  contactPhoneNumber: '',
  contactRelationship: 'parent',
  discoverySource: 'online',
  notes: '',
};

export const publicOutreachFormDefaultValues: PublicOutreachFormValues = {
  ...outreachFormDefaultValues,
  submittedByRole: 'parent',
  website: '',
};
