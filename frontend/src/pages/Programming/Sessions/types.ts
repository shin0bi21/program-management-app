import type { SessionSortKey } from '../../../common/types/cohort';
import type { ListSort } from '../../../common/types/pagination';

export type SessionStatusFilter = 'upcoming' | 'completed';
export type SessionView = 'calendar' | 'table';

export interface SessionPreference {
  view: SessionView;
  programIds: string[];
  cohortId: string | null;
  sessionTypeIds: string[];
  statuses: SessionStatusFilter[];
  sorting?: ListSort<SessionSortKey>;
  columnWidths?: Record<string, number>;
  hiddenColumns?: string[];
}
