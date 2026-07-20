export interface CohortInterestSubmission {
  id: string;
  youthFirstName: string;
  youthLastName: string;
  contactFirstName: string | null;
  contactLastName: string | null;
  contactPhoneNumber: string | null;
  contactRelationship: 'parent' | 'sibling' | 'guardian' | 'emergency' | null;
  age: number;
  school: string;
  email: string | null;
  phoneNumber: string | null;
  discoverySource: 'online' | 'friend_family' | 'school' | 'community_outreach' | 'other';
  message: string | null;
  status: 'new' | 'reviewed' | 'converted' | 'spam' | 'contacted' | 'signed_up' | 'lost';
  createdAt: string;
  statusUpdatedAt: string;
}
