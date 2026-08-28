import { useCallback, useMemo, useState } from 'react';

import type { ConfirmAction } from '../../../../common/components/ConfirmModal/types';
import type { Account } from '../../../../common/types/account';

interface AccountModalActions {
  revokeInvite: (account: Account) => Promise<void>;
  toggleStatus: (account: Account) => Promise<void>;
}

export default function useAccountModals({ revokeInvite, toggleStatus }: AccountModalActions) {
  // Account editor workflow.
  const [accountTarget, setAccountTarget] = useState<Account | 'new' | null>(null);
  const openNewAccount = useCallback(() => setAccountTarget('new'), []);
  const openAccount = useCallback((account: Account) => setAccountTarget(account), []);
  const closeAccount = useCallback(() => setAccountTarget(null), []);

  // Youth invitation workflow.
  const [youthInviteOpen, setYouthInviteOpen] = useState(false);
  const openYouthInvite = useCallback(() => setYouthInviteOpen(true), []);
  const closeYouthInvite = useCallback(() => setYouthInviteOpen(false), []);

  // Destructive account confirmation workflow.
  const [confirmation, setConfirmation] = useState<ConfirmAction | null>(null);
  const requestRevoke = useCallback((account: Account) => setConfirmation({
    title: 'Revoke Invitation',
    message: `Revoke the invitation for ${account.firstName} ${account.lastName}?`,
    confirmLabel: 'Revoke',
    confirmVariant: 'danger',
    successMessage: 'Invitation revoked',
    onConfirm: () => revokeInvite(account),
  }), [revokeInvite]);
  const requestStatusToggle = useCallback((account: Account) => {
    const activating = account.status === 'inactive';
    setConfirmation({
      title: activating ? 'Activate Account' : 'Deactivate Account',
      message: `${activating ? 'Activate' : 'Deactivate'} login access for ${account.firstName} ${account.lastName}?`,
      confirmLabel: activating ? 'Activate' : 'Deactivate',
      confirmVariant: activating ? 'primary' : 'danger',
      successMessage: activating ? 'Account activated' : 'Account deactivated',
      onConfirm: () => toggleStatus(account),
    });
  }, [toggleStatus]);
  const closeConfirmation = useCallback(() => setConfirmation(null), []);

  return useMemo(() => ({
    account: { target: accountTarget, openNew: openNewAccount, open: openAccount, close: closeAccount },
    youthInvite: { open: youthInviteOpen, show: openYouthInvite, close: closeYouthInvite },
    confirmation: { action: confirmation, requestRevoke, requestStatusToggle, close: closeConfirmation },
  }), [
    accountTarget,
    closeAccount,
    closeConfirmation,
    closeYouthInvite,
    confirmation,
    openAccount,
    openNewAccount,
    openYouthInvite,
    requestRevoke,
    requestStatusToggle,
    youthInviteOpen,
  ]);
}
