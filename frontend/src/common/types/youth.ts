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
  cohorts: Array<{
    id: string;
    name: string;
    programId: string;
    programName: string;
    rosterMode: 'enrolled' | 'open';
    startsOn: string;
    endsOn: string;
    enrolledOn: string | null;
    withdrawnOn: string | null;
    presentCount: number;
    lateCount: number;
    absentCount: number;
    lastAttendedOn: string | null;
  }>;
  gradeLevel: number | null;
  ageGroup: 'junior_youth' | 'senior_youth' | null;
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
  title: string;
  details: string | null;
  createdAt: string;
  updatedAt: string;
  createdByName: string | null;
}

export interface SetYouthInput {
  id?: string;
  firstName: string;
  lastName: string;
  email?: string;
  dateOfBirth?: string;
  schoolId?: string;
  gradeLevel?: number;
  addresses?: Array<{
    address: string;
  }>;
  contacts?: Array<{
    phoneNumber: string;
    type: 'parent' | 'sibling' | 'guardian';
  }>;
}

export interface YouthFilters {
  search?: string;
  statuses?: Array<'active' | 'inactive'>;
  programIds?: string[];
  cohortIds?: string[];
}
export type YouthSortKey = 'firstName' | 'lastName' | 'age' | 'school' | 'grade' | 'program' | 'status';
