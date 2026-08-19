import type { TimesheetItem } from '../../common/features/timeEntries/types';

export function makeTimesheetItem(overrides: Partial<TimesheetItem> = {}): TimesheetItem {
  return {
    id: 'time-entry-1',
    programId: null,
    programName: null,
    cycleId: 'cycle-1',
    cycleName: 'Summer 2026',
    category: 'meeting',
    categoryLabel: 'Meeting',
    taskId: null,
    taskTitle: null,
    sessionId: null,
    sessionLabel: null,
    hours: 1,
    note: 'Team meeting',
    ...overrides,
  };
}

