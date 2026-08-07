import { getAccounts } from '../../../../common/api/accounts.api';
import useInfiniteListQuery from '../../../../common/hooks/useInfiniteListQuery';
import type { Account, AccountFilters, AccountSortKey } from '../../../../common/types/account';
import type { ListSort } from '../../../../common/types/pagination';

export function useAccounts(filters: AccountFilters | null, sorting: ListSort<AccountSortKey>) {
  const query = useInfiniteListQuery<Account>({
    queryKey: ['accounts', filters, sorting],
    queryFn: ({ signal, pageParam }) => getAccounts(filters ?? {}, { ...sorting, cursor: pageParam ?? undefined, limit: 25 }, { signal }),
    errorMessage: 'Failed to fetch accounts',
    enabled: filters !== null,
  });

  return {
    accounts: query.rows,
    upsertAccount: query.upsert,
    removeAccount: query.remove,
    loading: query.loading,
    error: query.error,
    refetch: query.refetch,
    hasNextPage: query.hasNextPage,
    loadingNextPage: query.loadingNextPage,
    loadNextPage: query.loadNextPage,
  };
}
