import type { ProgramReference } from '../referenceData/referenceData.api';

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
