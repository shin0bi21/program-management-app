import { z } from 'zod';
import { getDate } from '../../utils/date';
import { isDateKey } from '../../utils/dateRange';

export const outreachFormSchema = z.object({
  youthFirstName: z.string().trim().min(1, 'First name is required').max(120, 'First name is too long'),
  youthLastName: z.string().trim().min(1, 'Last name is required').max(120, 'Last name is too long'),
  dateOfBirth: z.string().min(1, 'Date of birth is required')
    .pipe(z.string().refine(isDateKey, { message: 'Enter a valid date of birth', abort: true }))
    .refine(value => value < getDate(), 'Date of birth must be before today'),
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
