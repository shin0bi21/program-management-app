export type LeadStatus = 'new' | 'contacted' | 'eligible' | 'ineligible' | 'deferred' | 'closed' | 'signed_up';
export type EditableLeadStatus = Exclude<LeadStatus, 'new' | 'signed_up'>;
export type LeadOrigin = 'external' | 'internal';
export type LeadSubmitterRole = 'youth' | 'parent' | 'guardian' | 'staff';
export type LeadRelationship = 'parent' | 'sibling' | 'guardian';
export type DiscoverySource = 'online' | 'friend_family' | 'school' | 'community_outreach' | 'other';

export interface Lead {
  id: string;
  origin: LeadOrigin;
  submittedByRole: LeadSubmitterRole;
  convertedYouthId: string | null;
  youthFirstName: string;
  youthLastName: string;
  dateOfBirth: string | null;
  age: number | null;
  school: string;
  recommendedProgramId: string | null;
  recommendedProgramName: string | null;
  contactPhoneNumber: string;
  contactRelationship: LeadRelationship;
  discoverySource: DiscoverySource;
  notes: string | null;
  status: LeadStatus;
  statusUpdatedAt: string;
  createdAt: string;
}

export interface LeadNote {
  id: string;
  leadId: string;
  category: 'follow_up';
  details: string;
  createdAt: string;
  updatedAt: string;
  createdByName: string | null;
}

export interface LeadFilters {
  search?: string;
  statuses?: LeadStatus[];
  programIds?: string[];
  origins?: LeadOrigin[];
  submitterRoles?: LeadSubmitterRole[];
}

export const LEAD_TABLE_KEYS = ['firstName', 'lastName', 'school', 'program', 'status', 'created'] as const;
export type LeadSortKey = typeof LEAD_TABLE_KEYS[number];
