import { useEffect, useMemo, useState } from 'react';
import Header from '../../../common/components/Header/Header';
import Button from '../../../common/components/Button/Button';
import Modal from '../../../common/components/Modal/Modal';
import Table, { TableColumn } from '../../../common/components/Table/Table';
import ActionsMenu from '../../../common/components/ActionsMenu/ActionsMenu';
import FilterCard, { type FilterCardCategory } from '../../../common/components/FilterCard/FilterCard';
import SearchInput from '../../../common/components/SearchInput/SearchInput';
import PageHeader from '../../../common/components/PageHeader/PageHeader';
import { useAuth } from '../../../common/context/AuthContext';
import { useConfirmModal, type ConfirmAction } from '../../../common/components/Modal/hooks/useConfirmModal';
import { revokeAccountInvite, toggleAccountStatus } from '../../../common/api/accounts.api';
import type { Account, AccountRole, AccountSortKey, AccountStatus } from '../../../common/types/account';
import type { ListSort } from '../../../common/types/pagination';
import useUserPreference from '../../../common/hooks/useUserPreference';
import { formatShortDate } from '../../../common/utils/date';
import YouthModal from '../../Youth/components/YouthModal/YouthModal';
import AccountModal from './components/AccountModal/AccountModal';
import { useAccounts } from './hooks/useAccounts';
import './Users.css';

function titleCase(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function statusBadge(status: AccountStatus) {
  return <span className={`status-badge status-${status}`}>{titleCase(status)}</span>;
}

export default function Users() {
  const { role, permissions } = useAuth();
  const isAdmin = role === 'admin';
  const canWrite = permissions.includes('write:accounts');
  const canInviteYouth = permissions.includes('write:youth_profiles');
  const [search, setSearch] = useState('');
  const [statusFilters, setStatusFilters] = useState<AccountStatus[]>([]);
  const [roleFilters, setRoleFilters] = useState<AccountRole[]>([]);
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [filtersReady, setFiltersReady] = useState(false);
  const [sorting, setSorting] = useState<ListSort<AccountSortKey>>({ key: 'name', direction: 'asc' });
  const [columnWidths, setColumnWidths] = useState<Record<string, number>>({});
  const { preference, loading: preferenceLoading, error: preferenceError, save } = useUserPreference('account-filters');
  const queryFilters = useMemo(() => filtersReady ? ({
    search: debouncedSearch,
    roles: roleFilters,
    statuses: statusFilters,
  }) : null, [debouncedSearch, filtersReady, roleFilters, statusFilters]);
  const { accounts, upsertAccount, removeAccount, loading, refreshing, error, hasNextPage, loadingNextPage, loadNextPage } = useAccounts(queryFilters, sorting);
  const [modalTarget, setModalTarget] = useState<Account | 'new' | null>(null);
  const [youthInviteOpen, setYouthInviteOpen] = useState(false);
  const [confirmAction, setConfirmAction] = useState<ConfirmAction | null>(null);
  const confirmModal = useConfirmModal({ action: confirmAction, onClose: () => setConfirmAction(null) });

  useEffect(() => {
    const timeout = window.setTimeout(() => setDebouncedSearch(search.trim()), 250);
    return () => window.clearTimeout(timeout);
  }, [search]);

  useEffect(() => {
    if (filtersReady || preferenceLoading) return;
    setStatusFilters(preference?.statuses ?? []);
    setRoleFilters(preference?.roles ?? []);
    setSorting(preference?.sorting ?? { key: 'name', direction: 'asc' });
    setColumnWidths(preference?.columnWidths ?? {});
    setFiltersReady(true);
  }, [filtersReady, preference, preferenceLoading]);

  const filterCategories = useMemo<FilterCardCategory[]>(() => [
    { id: 'status', label: 'Status', options: [
      { value: 'active', label: 'Active' },
      { value: 'invited', label: 'Invited' },
      { value: 'inactive', label: 'Inactive' },
    ] },
    ...(isAdmin ? [{ id: 'role', label: 'Role', options: [
      { value: 'admin', label: 'Admin' },
      { value: 'staff', label: 'Staff' },
      { value: 'youth', label: 'Youth' },
    ] }] : []),
  ], [isAdmin]);

  const requestRevoke = (account: Account) => setConfirmAction({
    title: 'Revoke Invitation',
    message: `Revoke the invitation for ${account.firstName} ${account.lastName}?`,
    confirmLabel: 'Revoke',
    confirmVariant: 'danger',
    successMessage: 'Invitation revoked',
    onConfirm: async () => {
      await revokeAccountInvite(account.id);
      removeAccount(account.id);
    },
  });

  const requestStatusToggle = (account: Account) => {
    const activating = account.status === 'inactive';
    setConfirmAction({
      title: activating ? 'Activate Account' : 'Deactivate Account',
      message: `${activating ? 'Activate' : 'Deactivate'} login access for ${account.firstName} ${account.lastName}?`,
      confirmLabel: activating ? 'Activate' : 'Deactivate',
      confirmVariant: activating ? 'primary' : 'danger',
      successMessage: activating ? 'Account activated' : 'Account deactivated',
      onConfirm: async () => upsertAccount(await toggleAccountStatus(account.id)),
    });
  };

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
  }, [canWrite, isAdmin]);

  return (
    <>
      <Header />
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
          filters={<FilterCard
            categories={filterCategories}
            values={{ status: statusFilters, role: roleFilters }}
            onApply={(categoryId, selected) => {
              const statuses = categoryId === 'status' ? selected as AccountStatus[] : statusFilters;
              const roles = categoryId === 'role' ? selected as AccountRole[] : roleFilters;
              setStatusFilters(statuses);
              setRoleFilters(roles);
              void save({ statuses, roles, sorting, columnWidths });
            }}
            onClearAll={() => {
              setStatusFilters([]);
              setRoleFilters([]);
              void save({ statuses: [], roles: [], sorting, columnWidths });
            }}
          />}
        />
        {preferenceError && <p className="form-error" role="alert">{preferenceError}</p>}

        <section className="accounts-panel" aria-label="Accounts">
          <Table
            ariaLabel="Accounts"
            columns={columns}
            data={accounts}
            loading={loading}
            refreshing={refreshing}
            error={error}
            emptyMessage={search || statusFilters.length || roleFilters.length ? 'No accounts match these filters' : 'No accounts found'}
            keyExtractor={account => account.id}
            sorting={sorting}
            onSortingChange={next => { const value = next as ListSort<AccountSortKey>; setSorting(value); void save({ statuses: statusFilters, roles: roleFilters, sorting: value, columnWidths }); }}
            columnWidths={columnWidths}
            onColumnWidthsChange={next => { setColumnWidths(next); void save({ statuses: statusFilters, roles: roleFilters, sorting, columnWidths: next }); }}
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
          onSuccess={account => {
            upsertAccount(account);
          }}
        />
      )}

      {youthInviteOpen && (
        <YouthModal
          isOpen
          showLoginEmail
          onClose={() => setYouthInviteOpen(false)}
          onSuccess={youth => {
            if (youth.account) {
              const account = youth.account;
              upsertAccount({
                id: youth.id,
                firstName: youth.firstName,
                lastName: youth.lastName,
                email: account.email,
                role: 'youth',
                status: account.status,
                createdAt: youth.createdAt,
              });
            }
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
        disableClose={confirmModal.disableClose}
        successDelay={confirmModal.successDelay}
      >
        {confirmAction && <p>{confirmAction.message}</p>}
      </Modal>
    </>
  );
}
