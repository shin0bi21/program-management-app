import { z } from 'zod';

const namePattern = /^[a-zA-Z\s'-]+$/;

export const outreachFormSchema = z.object({
  youthFirstName: z.string().trim().min(1, 'First name is required').regex(namePattern, 'Enter a valid first name'),
  youthLastName: z.string().trim().min(1, 'Last name is required').regex(namePattern, 'Enter a valid last name'),
  age: z.number().int('Age must be a whole number').min(5, 'Age must be 5 or higher').max(24, 'Age must be 24 or lower'),
  school: z.string().trim().min(1, 'School is required'),
  programId: z.string().optional(),
  contactPhoneNumber: z.string().trim().min(1, 'Contact phone number is required'),
  contactRelationship: z.enum(['parent', 'guardian', 'sibling'], { error: 'Relationship is required' }),
  discoverySource: z.enum(['online', 'friend_family', 'school', 'community_outreach', 'other'], { error: 'Discovery source is required' }),
  notes: z.string().max(5000, 'Notes must be 5000 characters or fewer'),
});

export type OutreachFormValues = z.infer<typeof outreachFormSchema>;

export const publicOutreachFormSchema = outreachFormSchema.extend({
  submittedByRole: z.enum(['youth', 'parent', 'guardian'], { error: 'Select who is filling out the form' }),
});

export type PublicOutreachFormValues = z.infer<typeof publicOutreachFormSchema>;

export const outreachFormDefaultValues: OutreachFormValues = {
  youthFirstName: '',
  youthLastName: '',
  age: Number.NaN,
  school: '',
  programId: '',
  contactPhoneNumber: '',
  contactRelationship: 'parent',
  discoverySource: 'online',
  notes: '',
};

export const publicOutreachFormDefaultValues: PublicOutreachFormValues = {
  ...outreachFormDefaultValues,
  submittedByRole: 'parent',
};
