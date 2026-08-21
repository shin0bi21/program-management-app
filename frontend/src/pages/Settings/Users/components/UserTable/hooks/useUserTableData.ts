import useInfiniteListQuery from '../../../../../../query/hooks/useInfiniteListQuery';
import type { Account, AccountFilters, AccountSortKey } from '../../../../../../common/types/account';
import type { ListSort } from '../../../../../../common/types/pagination';
import { getAccounts } from '../../../accounts.api';

export default function useUserTableData(
  queryKey: readonly unknown[],
  filters: AccountFilters | null,
  sorting: ListSort<AccountSortKey>,
) {
  return useInfiniteListQuery<Account>({
    queryKey: [...queryKey, filters, sorting],
    queryFn: ({ signal, pageParam }) => {
      if (filters === null) throw new Error('User table filters are not initialized');
      return getAccounts(filters, { ...sorting, cursor: pageParam ?? undefined, limit: 25 }, { signal });
    },
    errorMessage: 'Failed to fetch accounts',
    enabled: filters !== null,
  });
}
