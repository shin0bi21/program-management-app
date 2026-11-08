import type { ContactRelationship } from '../../common/features/contacts/types';

export interface YouthProfile {
  id: string;
  firstName: string;
  lastName: string;
  account: {
    email: string;
    status: 'invited' | 'active' | 'inactive';
  } | null;
  /** Calendar date in YYYY-MM-DD format, or null when unknown. */
  dateOfBirth: string | null;
  schoolId: string | null;
  schoolName: string | null;
  activeProgram: { programId: string; program: string } | null;
  createdAt: string;
  addresses: Array<{
    id: string;
    address: string;
  }> | null;
  contacts: Array<{
    id: string;
    phoneNumber: string | null;
    type: ContactRelationship;
  }> | null;
}

export type YouthProfileNoteCategory = 'general' | 'health' | 'preference';

export interface YouthProfileNote {
  id: string;
  youthId: string;
  category: YouthProfileNoteCategory;
  details: string;
  createdAt: string;
  updatedAt: string;
  createdByName: string | null;
}

export interface YouthFilters {
  search?: string;
  programIds?: string[];
  cycleIds?: string[];
}

export const YOUTH_TABLE_KEYS = ['firstName', 'lastName', 'dateOfBirth', 'school', 'activeProgram'] as const;
export type YouthSortKey = typeof YOUTH_TABLE_KEYS[number];
