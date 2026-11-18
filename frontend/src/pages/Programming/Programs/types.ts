import type { ProgramReference } from '../../../common/features/referenceData/referenceData.api';

export type ProgramWeekday = 'sunday' | 'monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday' | 'saturday';

export interface Program extends ProgramReference {
  description?: string | null;
  enrollmentRequired: boolean;
  minAge: number | null;
  maxAge: number | null;
  defaultDayOfWeek: ProgramWeekday;
  defaultStartTime: string;
  defaultEndTime: string;
  timezone: 'America/Toronto';
}

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
  uniqueAttendeeCount: number;
}
