import { useCallback, useMemo, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../../../auth/authContext';
import Button from '../../../common/components/Button/Button';
import ActionsMenu from '../../../common/components/ActionsMenu/ActionsMenu';
import ColumnVisibilityMenu from '../../../common/components/ColumnVisibilityMenu/ColumnVisibilityMenu';
import FilterCard from '../../../common/components/FilterCard/FilterCard';
import Modal from '../../../common/components/Modal/Modal';
import { useConfirmModal, type ConfirmAction } from '../../../common/components/Modal/hooks/useConfirmModal';
import PageHeader from '../../../common/components/PageHeader/PageHeader';
import SearchInput from '../../../common/components/SearchInput/SearchInput';
import Table, { type TableColumn } from '../../../common/components/Table/Table';
import YouthModal from '../../../common/features/youth/components/YouthModal/YouthModal';
import { YOUTH_QUERY_KEY } from '../../../common/features/youth/queryKeys';
import type { Account, AccountStatus } from '../../../common/types/account';
import { formatShortDate } from '../../../common/utils/date';
import { removeInfiniteListRow } from '../../../query/infiniteListCache';
import { revokeAccountInvite, toggleAccountStatus } from './api/accounts.api';
import AccountModal from './components/AccountModal/AccountModal';
import { useAccountControls } from './hooks/useAccountControls';
import { useAccounts } from './hooks/useAccounts';
import { ACCOUNTS_LIST_QUERY_KEY } from './queryKeys';
import './Users.css';

export default function Users() {
  // Services and permissions.
  const queryClient = useQueryClient();
  const { role, permissions } = useAuth();
  const isAdmin = role === 'admin';
  const canWrite = permissions.includes('write:accounts');
  const canInviteYouth = permissions.includes('write:youth_profiles');

  // Controls and remote records.
  const controls = useAccountControls(isAdmin);
  const {
    search, setSearch, queryFilters, statusFilters, roleFilters, sorting,
    columnWidths, hiddenColumns, error: preferenceError, filterCategories,
    hasActiveQueryFilters,
  } = controls;
  const { accounts, loading, refreshing, error, hasNextPage, loadingNextPage, loadNextPage } = useAccounts(queryFilters, sorting);

  // Dialog state.
  const [modalTarget, setModalTarget] = useState<Account | 'new' | null>(null);
  const [youthInviteOpen, setYouthInviteOpen] = useState(false);
  const [confirmAction, setConfirmAction] = useState<ConfirmAction | null>(null);
  const confirmModal = useConfirmModal({ action: confirmAction, onClose: () => setConfirmAction(null) });

  // Mutations and confirmation workflows.
  const requestRevoke = useCallback((account: Account) => setConfirmAction({
    title: 'Revoke Invitation',
    message: `Revoke the invitation for ${account.firstName} ${account.lastName}?`,
    confirmLabel: 'Revoke',
    confirmVariant: 'danger',
    successMessage: 'Invitation revoked',
    onConfirm: async () => {
      await revokeAccountInvite(account.id);
      removeInfiniteListRow(queryClient, ACCOUNTS_LIST_QUERY_KEY, account.id);
    },
  }), [queryClient]);

  const requestStatusToggle = useCallback((account: Account) => {
    const activating = account.status === 'inactive';
    setConfirmAction({
      title: activating ? 'Activate Account' : 'Deactivate Account',
      message: `${activating ? 'Activate' : 'Deactivate'} login access for ${account.firstName} ${account.lastName}?`,
      confirmLabel: activating ? 'Activate' : 'Deactivate',
      confirmVariant: activating ? 'primary' : 'danger',
      successMessage: activating ? 'Account activated' : 'Account deactivated',
      onConfirm: async () => {
        await toggleAccountStatus(account.id);
        await queryClient.invalidateQueries({ queryKey: ACCOUNTS_LIST_QUERY_KEY });
      },
    });
  }, [queryClient]);

  // Table presentation.
  const columns = useMemo<TableColumn<Account>[]>(() => {
    const accountColumns: TableColumn<Account>[] = [
      {
        key: 'name',
        sortKey: 'name',
        header: 'Name',
        render: account => `${account.firstName} ${account.lastName}`,
      },
      { key: 'email', sortKey: 'email', header: 'Email', render: account => account.email },
      { key: 'role', sortKey: 'role', header: 'Role', width: 110, render: account => titleCase(account.role) },
      { key: 'status', sortKey: 'status', header: 'Status', width: 120, render: account => statusBadge(account.status) },
      {
        key: 'createdAt',
        sortKey: 'createdAt',
        header: 'Created',
        width: 150,
        render: account => formatShortDate(account.createdAt),
      },
    ];

    if (!canWrite) return accountColumns;

    return [...accountColumns, {
      key: 'actions',
      width: 40,
      resizable: false,
      header: '',
      className: 'col-actions',
      render: account => (
        <ActionsMenu
          ariaLabel={`More actions for ${account.firstName} ${account.lastName}`}
          items={[
            ...(isAdmin && account.role !== 'youth'
              ? [{ id: 'edit', label: 'Edit', onClick: () => setModalTarget(account) }]
              : []),
            ...(account.status === 'invited'
              ? [{ id: 'revoke', label: 'Revoke Invite', variant: 'danger' as const, onClick: () => requestRevoke(account) }]
              : []),
            ...(account.status === 'active'
              ? [{ id: 'deactivate', label: 'Deactivate', variant: 'danger' as const, onClick: () => requestStatusToggle(account) }]
              : []),
            ...(account.status === 'inactive'
              ? [{ id: 'activate', label: 'Activate', onClick: () => requestStatusToggle(account) }]
              : []),
          ]}
        />
      ),
    }];
  }, [canWrite, isAdmin, requestRevoke, requestStatusToggle]);

  return (
    <>
      <main className="page-container manage-accounts-page">
        <PageHeader
          title="Users"
          actions={(
            <div className="users-actions">
              {isAdmin && canWrite && canInviteYouth ? (
                <ActionsMenu
                  triggerLabel="+ Add"
                  items={[
                    { id: 'invite-staff', label: 'Invite Staff', onClick: () => setModalTarget('new') },
                    { id: 'invite-youth', label: 'Invite Youth', onClick: () => setYouthInviteOpen(true) },
                  ]}
                />
              ) : canInviteYouth ? (
                <Button onClick={() => setYouthInviteOpen(true)}>+ Add</Button>
              ) : isAdmin && canWrite ? (
                <Button onClick={() => setModalTarget('new')}>+ Add</Button>
              ) : null}
            </div>
          )}
          search={<SearchInput label="Search accounts" value={search} onChange={event => setSearch(event.target.value)} placeholder="Search by name or email" />}
          columns={<ColumnVisibilityMenu columns={columns} hiddenColumnKeys={hiddenColumns} onHiddenColumnKeysChange={controls.setHiddenColumns} />}
          filters={<FilterCard
            categories={filterCategories}
            values={{ status: statusFilters, role: roleFilters }}
            onApply={controls.applyFilter}
            onClearAll={controls.clearFilters}
          />}
        />
        {preferenceError && <p className="form-error" role="alert">{preferenceError}</p>}

        <section className="accounts-panel" aria-label="Accounts">
          <Table
            ariaLabel="Accounts"
            columns={columns}
            hiddenColumnKeys={hiddenColumns}
            data={accounts}
            loading={loading}
            refreshing={refreshing}
            error={error}
            emptyMessage={hasActiveQueryFilters ? 'No accounts match these filters' : 'No accounts found'}
            keyExtractor={account => account.id}
            sorting={sorting}
            onSortingChange={controls.setSorting}
            columnWidths={columnWidths}
            onColumnWidthsChange={controls.setColumnWidths}
            hasNextPage={hasNextPage}
            loadingNextPage={loadingNextPage}
            onLoadNextPage={loadNextPage}
          />
        </section>
      </main>

      {isAdmin && canWrite && modalTarget !== null && (
        <AccountModal
          isOpen
          account={modalTarget !== 'new' && modalTarget !== null ? modalTarget : undefined}
          onClose={() => setModalTarget(null)}
          onSuccess={() => {
            void queryClient.invalidateQueries({ queryKey: ACCOUNTS_LIST_QUERY_KEY });
          }}
        />
      )}

      {youthInviteOpen && (
        <YouthModal
          isOpen
          showLoginEmail
          onClose={() => setYouthInviteOpen(false)}
          onSuccess={() => {
            void Promise.all([
              queryClient.invalidateQueries({ queryKey: ACCOUNTS_LIST_QUERY_KEY }),
              queryClient.invalidateQueries({ queryKey: YOUTH_QUERY_KEY }),
            ]);
            setYouthInviteOpen(false);
          }}
        />
      )}

      <Modal
        isOpen={!!confirmAction}
        onClose={() => setConfirmAction(null)}
        title={confirmAction?.title ?? ''}
        status={confirmModal.status}
        statusMessage={confirmModal.statusMessage}
        footer={confirmModal.footer}
        successDelay={confirmModal.successDelay}
      >
        {confirmAction && <p>{confirmAction.message}</p>}
      </Modal>
    </>
  );
}

function titleCase(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function statusBadge(status: AccountStatus) {
  return <span className={`status-badge status-${status}`}>{titleCase(status)}</span>;
}
