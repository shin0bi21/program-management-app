export interface ExpressionOfInterest {
  id: string;
  youthFirstName: string;
  youthLastName: string;
  contactPhoneNumber: string | null;
  contactRelationship: 'parent' | 'sibling' | 'guardian' | null;
  age: number;
  school: string;
  submittedByRole: 'youth' | 'parent' | 'guardian' | null;
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
export type ExpressionOfInterestSortKey = 'name' | 'age' | 'school' | 'program' | 'submittedByRole' | 'createdAt' | 'status';

export interface ExpressionInterestPreference {
  statuses: ExpressionOfInterest['status'][];
  programIds: string[];
  sorting?: { key: ExpressionOfInterestSortKey; direction: 'asc' | 'desc' };
  columnWidths?: Record<string, number>;
  hiddenColumns?: string[];
}
