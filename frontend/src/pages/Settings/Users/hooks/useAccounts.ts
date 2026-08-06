import { getAccounts } from '../../../../common/api/accounts.api';
import useListQuery from '../../../../common/hooks/useListQuery';
import type { Account, AccountFilters } from '../../../../common/types/account';

export function useAccounts(filters: AccountFilters) {
  const query = useListQuery<Account>({
    queryKey: ['accounts', filters],
    queryFn: ({ signal }) => getAccounts(filters, { signal }),
    errorMessage: 'Failed to fetch accounts',
  });

  return {
    accounts: query.rows,
    upsertAccount: query.upsert,
    removeAccount: query.remove,
    loading: query.loading,
    error: query.error,
    refetch: query.refetch,
  };
}
