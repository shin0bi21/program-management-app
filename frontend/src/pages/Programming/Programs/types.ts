export interface ProgramCycleKey {
  programId: string;
  cycleId: string;
}

export interface ProgramCycleAssignment extends ProgramCycleKey {
  program: string;
  enrollmentRequired: boolean;
  minAge: number | null;
  maxAge: number | null;
  cycle: string;
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
