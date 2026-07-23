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
  programId: string | null;
  programName: string | null;
  notes: string | null;
  gradeLevel: number | null;
  ageGroup: 'junior_youth' | 'senior_youth' | null;
  createdAt: string;
  addresses: Array<{
    id: string;
    address: string;
    city: string;
    province: string;
    postalCode: string;
    country: string;
  }> | null;
  contacts: Array<{
    id: string;
    firstName: string;
    lastName: string;
    phoneNumber: string | null;
    type: string;
  }> | null;
}

export interface SetYouthInput {
  id?: string;
  firstName: string;
  lastName: string;
  email?: string;
  status: 'active' | 'inactive';
  dateOfBirth?: string;
  schoolId?: string;
  programId?: string | null;
  notes?: string | null;
  gradeLevel?: number;
  addresses?: Array<{
    address: string;
    city: string;
    province: string;
    postalCode: string;
  }>;
  contacts?: Array<{
    firstName: string;
    lastName: string;
    phoneNumber: string;
    type: 'parent' | 'sibling' | 'guardian';
  }>;
}

export interface YouthFilters {
  search?: string;
  statuses?: Array<'active' | 'inactive'>;
  programIds?: string[];
}
