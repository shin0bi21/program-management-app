import { useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';

import { YOUTH_QUERY_KEY } from '../../../../../common/features/youth/queryKeys';
import type { Account } from '../../../../../common/types/account';
import { removeInfiniteListRow, replaceInfiniteListRow } from '../../../../../query/infiniteListCache';
import { revokeAccountInvite, toggleAccountStatus } from '../../accounts.api';

interface AccountActionOptions {
  accountTableQueryKey: readonly unknown[];
}

export default function useAccountActions({ accountTableQueryKey }: AccountActionOptions) {
  const queryClient = useQueryClient();

  // Account mutations and table-cache reconciliation.
  const revokeInvite = useCallback(async (account: Account) => {
    await revokeAccountInvite(account.id);
    removeInfiniteListRow(queryClient, accountTableQueryKey, account.id);
  }, [accountTableQueryKey, queryClient]);

  const toggleStatus = useCallback(async (account: Account) => {
    const savedAccount = await toggleAccountStatus(account.id);
    replaceInfiniteListRow(queryClient, accountTableQueryKey, savedAccount);
  }, [accountTableQueryKey, queryClient]);

  const syncSavedAccount = useCallback((savedAccount: Account, isNew: boolean) => {
    if (isNew) {
      void queryClient.invalidateQueries({ queryKey: accountTableQueryKey });
      return;
    }

    replaceInfiniteListRow(queryClient, accountTableQueryKey, savedAccount);
  }, [accountTableQueryKey, queryClient]);

  // Youth invitations affect both the account list and youth-profile data.
  const syncYouthInvitation = useCallback(() => {
    void Promise.all([
      queryClient.invalidateQueries({ queryKey: accountTableQueryKey }),
      queryClient.invalidateQueries({ queryKey: YOUTH_QUERY_KEY }),
    ]);
  }, [accountTableQueryKey, queryClient]);

  return { revokeInvite, toggleStatus, syncSavedAccount, syncYouthInvitation };
}
