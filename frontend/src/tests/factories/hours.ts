import type { HoursItem } from '../../pages/Staff/Hours/types';

export function makeHoursItem(overrides: Partial<HoursItem> = {}): HoursItem {
  return {
    id: 'hours-1',
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
