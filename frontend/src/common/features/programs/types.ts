export type ProgramWeekday = 'sunday' | 'monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday' | 'saturday';

export interface Program {
  id: string;
  name: string;
  description?: string | null;
  rosterMode: 'enrolled' | 'open';
  minAge: number | null;
  maxAge: number | null;
  defaultDayOfWeek: ProgramWeekday;
  defaultStartTime: string;
  defaultEndTime: string;
  timezone: 'America/Toronto';
}

export interface CreateProgramInput {
  name: string;
  description?: string | null;
  rosterMode?: 'enrolled' | 'open';
  minAge?: number | null;
  maxAge?: number | null;
  defaultDayOfWeek?: ProgramWeekday;
  defaultStartTime?: string;
  defaultEndTime?: string;
  timezone?: 'America/Toronto';
}

export type UpdateProgramInput = CreateProgramInput;
