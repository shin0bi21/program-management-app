export interface CohortInterestSubmission {
  id: string;
  youthName: string;
  parentName: string | null;
  age: number;
  school: string | null;
  email: string | null;
  phoneNumber: string | null;
  discoverySource: 'online' | 'friend_family' | 'school' | 'community_outreach' | 'other' | null;
  message: string | null;
  status: 'new' | 'contacted' | 'signed_up' | 'lost';
  createdAt: string;
  statusUpdatedAt: string;
}
