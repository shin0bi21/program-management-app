import { createExternalLead } from './leadService';

export type PublicLeadInput = {
  youthFirstName: string;
  youthLastName: string;
  age: number;
  school: string;
  submittedByRole: 'youth' | 'parent' | 'guardian';
  discoverySource: 'online' | 'friend_family' | 'school' | 'community_outreach' | 'other';
  contactPhoneNumber: string;
  contactRelationship: 'parent' | 'sibling' | 'guardian';
  notes?: string;
};

export function submitPublicLead(data: PublicLeadInput) {
  return createExternalLead({
    youthFirstName: data.youthFirstName.trim(),
    youthLastName: data.youthLastName.trim(),
    age: data.age,
    school: data.school.trim(),
    discoverySource: data.discoverySource,
    contactPhoneNumber: data.contactPhoneNumber.trim(),
    contactRelationship: data.contactRelationship,
    notes: data.notes?.trim() || null,
  }, data.submittedByRole);
}
