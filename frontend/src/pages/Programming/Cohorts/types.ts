import type { CohortSortKey } from '../../../common/types/cohort';
import type { ListSort } from '../../../common/types/pagination';

export type CohortStatus = 'active' | 'upcoming' | 'completed';

export interface CohortPreference {
  programId: string | null;
  status: CohortStatus | null;
  sorting?: ListSort<CohortSortKey>;
  columnWidths?: Record<string, number>;
  hiddenColumns?: string[];
}
