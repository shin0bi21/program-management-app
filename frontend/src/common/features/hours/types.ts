export interface StaffResource {
  id: string;
  firstName: string;
  lastName: string;
  name: string;
  role: string;
  writable: boolean;
}
export interface HoursProgram { id: string; name: string }
export interface HoursCycle { id: string; name: string; state?: 'active' | 'upcoming' | 'completed' }
export type HoursCategory = 'program_delivery' | 'planning_prep' | 'meeting' | 'administration' | 'outreach' | 'maintenance' | 'other';
export interface HoursSession {
  id: string; label: string; programId: string; programName: string; workDate: string; startsAt: string;
}

export interface HoursItem {
  id: string;
  programId: string | null;
  programName: string | null;
  cycleId: string;
  cycleName: string;
  category: HoursCategory;
  categoryLabel: string;
  taskId: string | null;
  taskTitle: string | null;
  sessionId: string | null;
  sessionLabel: string | null;
  hours: number;
  note: string;
}
