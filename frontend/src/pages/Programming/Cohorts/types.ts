export interface ProgramCohort {
  id: string;
  programId: string;
  programName: string;
  enrollmentRequired: boolean;
  minAge: number | null;
  maxAge: number | null;
  cycleId: string;
  cycleName: string;
  name: string;
  startsOn: string;
  endsOn: string;
  state: 'upcoming' | 'active' | 'completed';
  enrolledCount: number;
  nextSessionAt: string | null;
  nextSessionId: string | null;
  averageAttendance: number | null;
  attendanceAttendedCount: number;
  attendanceRecordedCount: number;
  uniqueAttendeeCount: number;
}

export interface CohortRosterYouth {
  id: string;
  firstName: string;
  lastName: string;
  dateOfBirth: string | null;
  age: number | null;
  schoolName: string | null;
  cohorts: Array<{
    id: string;
    withdrawnOn: string | null;
  }>;
}

export interface CohortListFilters {
  programId?: string;
  search?: string;
  status?: string;
}

export const COHORT_TABLE_KEYS = ['program', 'cohort', 'start', 'end', 'status'] as const;
export type CohortSortKey = typeof COHORT_TABLE_KEYS[number];
