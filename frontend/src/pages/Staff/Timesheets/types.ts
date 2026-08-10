export interface StaffResource {
  id: string;
  name: string;
  role: string;
}

export interface TimesheetItem {
  id: string;
  programId: string | null;
  programName: string | null;
  cycleId: string;
  cycleName: string;
  task: TimeEntryTask;
  label: string;
  hours: number;
  note: string;
}

export interface TimeEntryProgram {
  id: string;
  name: string;
}

export type TimeEntryTask = 'program_delivery' | 'planning_prep' | 'meeting' | 'administration' | 'outreach' | 'maintenance' | 'other';

export interface TimeEntryCohort {
  id: string;
  cycleId: string;
  name: string;
  state: 'active' | 'upcoming' | 'completed';
}
