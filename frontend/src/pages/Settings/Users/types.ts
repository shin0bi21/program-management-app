import type { AccountRole, AccountSortKey, AccountStatus } from '../../../common/types/account';
import type { ListSort } from '../../../common/types/pagination';

export interface AccountPreference {
  statuses: AccountStatus[];
  roles: AccountRole[];
  sorting?: ListSort<AccountSortKey>;
  columnWidths?: Record<string, number>;
  hiddenColumns?: string[];
}
