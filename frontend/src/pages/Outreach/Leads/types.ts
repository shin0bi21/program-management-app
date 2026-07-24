export type LeadStatus = 'new' | 'contacted' | 'eligible' | 'ineligible' | 'signed_up';
export type LeadOrigin = 'expression_of_interest' | 'staff_created';
export type LeadRelationship = 'parent' | 'sibling' | 'guardian';
export type DiscoverySource = 'online' | 'friend_family' | 'school' | 'community_outreach' | 'other';

export interface Lead {
  id: string;
  origin: LeadOrigin;
  expressionOfInterestId: string | null;
  convertedYouthId: string | null;
  youthFirstName: string;
  youthLastName: string;
  age: number;
  school: string;
  programOfInterestId: string | null;
  programOfInterestName: string | null;
  contactFirstName: string;
  contactLastName: string;
  contactPhoneNumber: string;
  contactRelationship: LeadRelationship;
  discoverySource: DiscoverySource;
  notes: string | null;
  status: LeadStatus;
  statusUpdatedAt: string;
  createdAt: string;
}

export interface CreateLeadInput {
  youthFirstName: string;
  youthLastName: string;
  age: number;
  school: string;
  programOfInterestId?: string | null;
  contactFirstName: string;
  contactLastName: string;
  contactPhoneNumber: string;
  contactRelationship: LeadRelationship;
  discoverySource: DiscoverySource;
  notes?: string;
}

export type UpdateLeadInput = CreateLeadInput;

export interface LeadFilters {
  search?: string;
  statuses?: LeadStatus[];
  programIds?: string[];
}
