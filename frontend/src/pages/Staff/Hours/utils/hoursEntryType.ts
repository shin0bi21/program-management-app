import type { HoursItem } from '../types';
import type { HoursEntryType } from '../types';

export const HOURS_ENTRY_TYPE_LABELS: Record<HoursEntryType, string> = {
  task: 'Task',
  session: 'Session',
  other: 'Regular',
};

export function getHoursEntryType(item: HoursItem): HoursEntryType {
  return item.taskId ? 'task' : item.sessionId ? 'session' : 'other';
}
