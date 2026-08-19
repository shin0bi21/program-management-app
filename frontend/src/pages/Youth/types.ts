export type { YouthProfile, SetYouthInput } from '../../common/types/youth';

import type { ListSort } from '../../common/types/pagination';
import type { YouthSortKey } from '../../common/types/youth';

export type YouthStatusFilter = 'active' | 'inactive';

export interface YouthPreference {
  statuses: YouthStatusFilter[];
  programIds: string[];
  sorting?: ListSort<YouthSortKey>;
  columnWidths?: Record<string, number>;
  hiddenColumns?: string[];
}
