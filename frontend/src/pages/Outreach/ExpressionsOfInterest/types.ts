export interface ExpressionOfInterest {
  id: string;
  youthFirstName: string;
  youthLastName: string;
  contactPhoneNumber: string | null;
  contactRelationship: 'parent' | 'sibling' | 'guardian' | null;
  age: number;
  school: string;
  discoverySource: 'online' | 'friend_family' | 'school' | 'community_outreach' | 'other';
  notes: string | null;
  status: 'new' | 'reviewed' | 'converted' | 'spam' | 'contacted' | 'signed_up' | 'lost';
  createdAt: string;
  statusUpdatedAt: string;
  suggestedProgramId: string | null;
  suggestedProgramName: string | null;
}

export interface ExpressionOfInterestFilters {
  search?: string;
  statuses?: ExpressionOfInterest['status'][];
  programIds?: string[];
}
export type ExpressionOfInterestSortKey = 'name' | 'age' | 'school' | 'program' | 'createdAt' | 'status';
