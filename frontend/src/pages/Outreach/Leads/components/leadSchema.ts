import { z } from 'zod';

const namePattern = /^[a-zA-Z\s'-]+$/;
export const leadSchema = z.object({
  youthFirstName: z.string().trim().min(1, 'First name is required').regex(namePattern, 'Enter a valid first name'),
  youthLastName: z.string().trim().min(1, 'Last name is required').regex(namePattern, 'Enter a valid last name'),
  age: z.number().int('Age must be a whole number').min(5, 'Age must be 5 or higher').max(24, 'Age must be 24 or lower'),
  school: z.string().trim().min(1, 'School is required'),
  contactFirstName: z.string().trim().min(1, 'Contact first name is required').regex(namePattern, 'Enter a valid first name'),
  contactLastName: z.string().trim().min(1, 'Contact last name is required').regex(namePattern, 'Enter a valid last name'),
  contactPhoneNumber: z.string().trim().min(1, 'Contact phone number is required'),
  contactRelationship: z.enum(['parent', 'guardian', 'sibling', 'emergency'], { error: 'Relationship is required' }),
  discoverySource: z.enum(['online', 'friend_family', 'school', 'community_outreach', 'other'], { error: 'Discovery source is required' }),
  notes: z.string().max(5000, 'Notes must be 5000 characters or fewer'),
});

export type LeadFormData = z.infer<typeof leadSchema>;
