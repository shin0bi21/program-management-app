import { useCallback, useEffect, useRef, useState } from 'react';
import { getAccounts } from '../../../../common/api/accounts.api';
import { getErrorMessage } from '../../../../common/utils/clientErrors';
import type { Account } from '../../../../common/types/account';
import type { AccountFilters } from '../../../../common/types/account';

export function useAccounts(filters: AccountFilters) {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const requestId = useRef(0);

  const loadAccounts = useCallback(async () => {
    const currentRequest = ++requestId.current;
    setLoading(true);
    setError('');
    try {
      const nextAccounts = await getAccounts(filters);
      if (currentRequest === requestId.current) setAccounts(nextAccounts);
    } catch (err) {
      if (currentRequest === requestId.current) {
        setError(getErrorMessage(err, 'Failed to fetch accounts'));
      }
    } finally {
      if (currentRequest === requestId.current) setLoading(false);
    }
  }, [filters.search, filters.roles, filters.statuses]);

  useEffect(() => {
    loadAccounts();
  }, [loadAccounts]);

  return { accounts, setAccounts, loading, error, refetch: loadAccounts };
}
