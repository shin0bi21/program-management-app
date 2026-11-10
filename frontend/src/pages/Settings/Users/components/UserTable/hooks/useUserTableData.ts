import useInfiniteListQuery from '../../../../../../query/hooks/useInfiniteListQuery';
import type { User, UserFilters, UserSortKey } from '../../../types';
import type { ListSort } from '../../../../../../common/components/Table/Table.types';
import { getAccounts } from '../../../accounts.api';

export default function useUserTableData(
  queryKey: readonly unknown[],
  filters: UserFilters | null,
  sorting: ListSort<UserSortKey>,
) {
  return useInfiniteListQuery<User>({
    ordering: {
      direction: sorting.direction,
      getValue: account => ({
        name: `${account.firstName} ${account.lastName}`.toLowerCase(), email: account.email.toLowerCase(),
        role: account.role, status: account.status, createdAt: new Date(account.createdAt),
      }[sorting.key]),
    },
    queryKey: [...queryKey, filters, sorting],
    queryFn: ({ signal, pageParam }) => {
      if (filters === null) throw new Error('User table filters are not initialized');
      return getAccounts(filters, { ...sorting, cursor: pageParam ?? undefined }, { signal });
    },
    errorMessage: 'Failed to fetch accounts',
    enabled: filters !== null,
  });
}
