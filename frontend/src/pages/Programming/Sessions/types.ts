import type { SessionSortKey } from '../../../common/types/cohort';
import type { ListSort } from '../../../common/types/pagination';

export type SessionStatusFilter = 'upcoming' | 'completed';
export type SessionsView = 'list' | 'calendar';

export interface SessionPreference {
  view: SessionsView;
  programIds: string[];
  cohortId: string | null;
  sessionTypeIds: string[];
  statuses: SessionStatusFilter[];
  sorting?: ListSort<SessionSortKey>;
  columnWidths?: Record<string, number>;
  hiddenColumns?: string[];
}
