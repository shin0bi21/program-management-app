import type { HoursItem } from '../../pages/Staff/Hours/types';

/**
 * Builds a complete Hours entry with scenario overrides.
 * @param overrides - Entry fields supplied by the test scenario.
 * @example makeHoursItem({ hours: 2 }) // a two-hour meeting
 */
export function makeHoursItem(overrides: Partial<HoursItem> = {}): HoursItem {
  let type = overrides.type ?? 'regular';
  if (!overrides.type && overrides.taskId) type = 'task';
  if (!overrides.type && !overrides.taskId && overrides.sessionId) type = 'session';

  return {
    type,
    id: 'hours-1',
    staffId: 'staff-1',
    firstName: 'Zoe',
    lastName: 'Wilson',
    date: '2026-08-19',
    cycleStartsOn: '2026-07-01',
    cycleEndsOn: '2026-09-01',
    programId: null,
    program: null,
    cycleId: 'cycle-1',
    cycle: 'Summer 2026',
    category: 'meeting',
    categoryLabel: 'Meeting',
    taskId: null,
    taskTitle: null,
    sessionId: null,
    sessionTitle: null,
    hours: 1,
    note: 'Team meeting',
    ...overrides,
  };
}
