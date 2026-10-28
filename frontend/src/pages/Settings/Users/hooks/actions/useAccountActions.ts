import { useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';

import type { User } from '../../types';
import { removeInfiniteListRow, replaceInfiniteListRow } from '../../../../../query/infiniteListCache';
import { revokeAccountInvite, toggleAccountStatus } from '../../accounts.api';
import { referenceDataKeys } from '../../../../../common/features/referenceData/hooks/useReferenceData';

const YOUTH_QUERY_KEY = ['youth'] as const;

interface AccountActionOptions {
  accountTableQueryKey: readonly unknown[];
}

export default function useAccountActions({ accountTableQueryKey }: AccountActionOptions) {
  const queryClient = useQueryClient();

  // Account mutations and table-cache reconciliation.
  const revokeInvite = useCallback(async (account: User) => {
    await revokeAccountInvite(account.id);
    removeInfiniteListRow(queryClient, accountTableQueryKey, account.id);
  }, [accountTableQueryKey, queryClient]);

  const toggleStatus = useCallback(async (account: User) => {
    const savedAccount = await toggleAccountStatus(account.id);
    replaceInfiniteListRow(queryClient, accountTableQueryKey, savedAccount);
    void queryClient.invalidateQueries({ queryKey: referenceDataKeys.staff('tasks') });
    void queryClient.invalidateQueries({ queryKey: referenceDataKeys.staff('hours') });
  }, [accountTableQueryKey, queryClient]);

  const syncSavedAccount = useCallback((savedAccount: User, isNew: boolean) => {
    // Identity and assignments affect both resource labels and authorized reference scope.
    void queryClient.invalidateQueries({ queryKey: referenceDataKeys.staff('tasks') });
    void queryClient.invalidateQueries({ queryKey: referenceDataKeys.staff('hours') });
    void queryClient.invalidateQueries({ queryKey: referenceDataKeys.programs(true) });
    void queryClient.invalidateQueries({ queryKey: referenceDataKeys.sessionScheduling });

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
