import { getAccounts } from '../accounts.api';
import useInfiniteListQuery from '../../../../query/hooks/useInfiniteListQuery';
import type { Account, AccountFilters, AccountSortKey } from '../../../../common/types/account';
import type { ListSort } from '../../../../common/types/pagination';

export function useAccounts(
  queryKey: readonly unknown[],
  filters: AccountFilters | null,
  sorting: ListSort<AccountSortKey>,
) {
  const query = useInfiniteListQuery<Account>({
    queryKey: [...queryKey, filters, sorting],
    queryFn: ({ signal, pageParam }) => getAccounts(filters ?? {}, { ...sorting, cursor: pageParam ?? undefined, limit: 25 }, { signal }),
    errorMessage: 'Failed to fetch accounts',
    enabled: filters !== null,
  });

  return {
    accounts: query.rows,
    loading: query.loading,
    refreshing: query.refreshing,
    error: query.error,
    hasNextPage: query.hasNextPage,
    loadingNextPage: query.loadingNextPage,
    loadNextPage: query.loadNextPage,
  };
}
