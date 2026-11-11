import useInfiniteListQuery from '../../../../../../query/hooks/useInfiniteListQuery';
import type { User, UserFilters, UserSortKey } from '../../../types';
import type { ListSort } from '../../../../../../common/components/Table/Table.types';
import { getAccounts } from '../../../accounts.api';

/**
 * Loads account rows for the selected filters and server-compatible order.
 * @param queryKey - List-only cache scope for the account table.
 * @param filters - Applied filters; null waits for initialization.
 * @param sorting - Selected account column and direction.
 * @example useUserTableData(['accounts', 'table'], filters, sorting) // paginated account rows
 */
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
        role: account.role, status: account.status, createdAt: account.createdAt,
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
