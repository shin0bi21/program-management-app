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
import type { TableColumnDef } from '../../../common/components/Table/Table.types';
import YouthModal from '../../../common/features/youth/components/YouthModal/YouthModal';
import { YOUTH_QUERY_KEY } from '../../../common/features/youth/queryKeys';
import { ACCOUNT_TABLE_KEYS, type Account, type AccountStatus } from '../../../common/types/account';
import { formatShortDate } from '../../../common/utils/date';
import { removeInfiniteListRow, replaceInfiniteListRow } from '../../../query/infiniteListCache';
import { revokeAccountInvite, toggleAccountStatus } from './accounts.api';
import AccountModal from './components/AccountModal/AccountModal';
import UserTable from './components/UserTable/UserTable';
import { useAccountControls } from './hooks/useAccountControls';
import './Users.css';

const ACCOUNTS_TABLE_QUERY_KEY = ['accounts', 'table'] as const;

export default function Users() {
  // Services and permissions.
  const queryClient = useQueryClient();
  const { role, permissions } = useAuth();
  const isAdmin = role === 'admin';
  const canWrite = permissions.includes('write:accounts');
  const canInviteYouth = permissions.includes('write:youth_profiles');

  // Controls and remote records.
  const controls = useAccountControls(isAdmin, ACCOUNT_TABLE_KEYS);
  const {
    search, setSearch, queryFilters, statusFilters, roleFilters, sorting,
    columnWidths, hiddenColumns, error: preferenceError, filterCategories,
    hasActiveQueryFilters, ready: controlsReady,
  } = controls;
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
      removeInfiniteListRow(queryClient, ACCOUNTS_TABLE_QUERY_KEY, account.id);
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
        const savedAccount = await toggleAccountStatus(account.id);
        replaceInfiniteListRow(queryClient, ACCOUNTS_TABLE_QUERY_KEY, savedAccount);
      },
    });
  }, [queryClient]);

  // Table presentation.
  const columns = useMemo<TableColumnDef<Account>[]>(() => {
    const accountColumns: TableColumnDef<Account>[] = [
      {
        id: 'name',
        header: 'Name',
        accessorFn: account => `${account.firstName} ${account.lastName}`,
      },
      { id: 'email', header: 'Email', accessorFn: account => account.email },
      { id: 'role', header: 'Role', size: 110, accessorFn: account => titleCase(account.role) },
      {
        id: 'status',
        header: 'Status',
        size: 120,
        accessorFn: account => account.status,
        cell: ({ row }) => statusBadge(row.original.status),
      },
      {
        id: 'createdAt',
        header: 'Created',
        size: 150,
        accessorFn: account => formatShortDate(account.createdAt),
      },
    ];

    if (!canWrite) return accountColumns;

    return [...accountColumns, {
      id: 'actions',
      size: 40,
      enableResizing: false,
      enableHiding: false,
      header: '',

      cell: ({ row: { original: account } }) => (
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
          columns={controlsReady ? <ColumnVisibilityMenu columns={columns} hiddenColumnKeys={hiddenColumns} onHiddenColumnKeysChange={controls.setHiddenColumns} /> : undefined}
          filters={controlsReady ? <FilterCard
            categories={filterCategories}
            values={{ status: statusFilters, role: roleFilters }}
            onApply={controls.applyFilter}
            onClearAll={controls.clearFilters}
          /> : undefined}
        />
        {preferenceError && <p className="form-error" role="alert">{preferenceError}</p>}

        {!controlsReady ? <p role="status">Loading saved account preferences…</p> : <section className="accounts-panel" aria-label="Accounts">
          <UserTable
            queryKey={ACCOUNTS_TABLE_QUERY_KEY}
            filters={queryFilters}
            columns={columns}
            hiddenColumnKeys={hiddenColumns}
            hasActiveQueryFilters={hasActiveQueryFilters}
            sorting={sorting}
            onSortingChange={controls.setSorting}
            columnWidths={columnWidths}
            onColumnWidthsChange={controls.setColumnWidths}
          />
        </section>}
      </main>

      {isAdmin && canWrite && modalTarget !== null && (
        <AccountModal
          isOpen
          account={modalTarget !== 'new' && modalTarget !== null ? modalTarget : undefined}
          onClose={() => setModalTarget(null)}
          onSuccess={savedAccount => {
            if (modalTarget === 'new') {
              void queryClient.invalidateQueries({ queryKey: ACCOUNTS_TABLE_QUERY_KEY });
            } else {
              replaceInfiniteListRow(queryClient, ACCOUNTS_TABLE_QUERY_KEY, savedAccount);
            }
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
              queryClient.invalidateQueries({ queryKey: ACCOUNTS_TABLE_QUERY_KEY }),
              queryClient.invalidateQueries({ queryKey: YOUTH_QUERY_KEY }),
            ]);
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
