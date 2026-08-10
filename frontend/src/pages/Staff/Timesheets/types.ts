export interface StaffResource {
  id: string;
  name: string;
  role: string;
}

export interface TimesheetItem {
  id: string;
  programId: string | null;
  programName: string | null;
  cohortId: string | null;
  cohortName: string | null;
  task: TimeEntryTask;
  label: string;
  hours: number;
  note: string;
}

export interface TimeEntryProgram {
  id: string;
  name: string;
}

export type TimeEntryTask = 'programming' | 'planning_prep' | 'meeting' | 'administration' | 'promotion' | 'maintenance' | 'other';

export interface TimeEntryCohort {
  id: string;
  name: string;
  state: 'active' | 'upcoming' | 'completed';
}
