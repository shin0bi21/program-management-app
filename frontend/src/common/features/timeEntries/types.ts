export interface StaffResource { id: string; name: string; role: string; writable: boolean }
export interface TimeEntryProgram { id: string; name: string }
export interface TimeEntryCycle { id: string; name: string; state?: 'active' | 'upcoming' | 'completed' }
export type TimeEntryCategory = 'program_delivery' | 'planning_prep' | 'meeting' | 'administration' | 'outreach' | 'maintenance' | 'other';
export interface TimeEntryCohort { id: string; cycleId: string; name: string; state: 'active' | 'upcoming' | 'completed' }

export interface TimesheetItem {
  id: string;
  programId: string | null;
  programName: string | null;
  cycleId: string;
  cycleName: string;
  category: TimeEntryCategory;
  categoryLabel: string;
  taskId: string | null;
  taskTitle: string | null;
  hours: number;
  note: string;
}
