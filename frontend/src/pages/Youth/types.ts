export interface YouthProfile {
  id: string;
  firstName: string;
  lastName: string;
  active: boolean;
  dateOfBirth: string | null;
  schoolId: string | null;
  schoolName: string | null;
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
  active: boolean;
  dateOfBirth?: string;
  schoolId?: string;
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
