export interface YouthProfile {
  id: string;
  firstName: string;
  lastName: string;
  status: 'active' | 'inactive';
  account: {
    email: string;
    status: 'invited' | 'active' | 'inactive';
  } | null;
  dateOfBirth: string | null;
  schoolId: string | null;
  schoolName: string | null;
  programCycles: Array<{
    cycleId: string;
    cycleName: string;
    programId: string;
    programName: string;
    enrollmentRequired: boolean;
    startsOn: string;
    endsOn: string;
    enrolledOn: string | null;
    withdrawnOn: string | null;
    presentCount: number;
    lateCount: number;
    absentCount: number;
    lastAttendedOn: string | null;
  }>;
  lastAttendedOn: string | null;
  createdAt: string;
  addresses: Array<{
    id: string;
    address: string;
  }> | null;
  contacts: Array<{
    id: string;
    phoneNumber: string | null;
    type: string;
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

export const YOUTH_TABLE_KEYS = ['firstName', 'lastName', 'dateOfBirth', 'school', 'activePrograms', 'completedPrograms'] as const;
export type YouthSortKey = typeof YOUTH_TABLE_KEYS[number];
