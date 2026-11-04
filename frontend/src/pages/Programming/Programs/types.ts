export interface ProgramCycleKey {
  programId: string;
  cycleId: string;
}

export interface ProgramCycleAssignment extends ProgramCycleKey {
  programName: string;
  enrollmentRequired: boolean;
  minAge: number | null;
  maxAge: number | null;
  cycleName: string;
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
