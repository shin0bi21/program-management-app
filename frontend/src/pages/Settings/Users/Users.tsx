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
import { useConfirmModal, type ConfirmAction } from '../../../common/hooks/useConfirmModal';
import { revokeAccountInvite, toggleAccountStatus } from '../../../common/api/accounts.api';
import type { Account, AccountRole, AccountStatus } from '../../../common/types/account';
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
  const queryFilters = useMemo(() => ({
    search: debouncedSearch,
    roles: roleFilters,
    statuses: statusFilters,
  }), [debouncedSearch, roleFilters, statusFilters]);
  const { accounts, setAccounts, loading, error } = useAccounts(queryFilters);
  const [modalTarget, setModalTarget] = useState<Account | 'new' | null>(null);
  const [youthInviteOpen, setYouthInviteOpen] = useState(false);
  const [confirmAction, setConfirmAction] = useState<ConfirmAction | null>(null);
  const confirmModal = useConfirmModal({ action: confirmAction, onClose: () => setConfirmAction(null) });

  useEffect(() => {
    const timeout = window.setTimeout(() => setDebouncedSearch(search.trim()), 250);
    return () => window.clearTimeout(timeout);
  }, [search]);

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

  const updateStoredAccount = (updated: Account) => {
    setAccounts(previous => previous.map(account => account.id === updated.id ? updated : account));
  };

  const requestRevoke = (account: Account) => setConfirmAction({
    title: 'Revoke Invitation',
    message: `Revoke the invitation for ${account.firstName} ${account.lastName}?`,
    confirmLabel: 'Revoke',
    confirmVariant: 'danger',
    successMessage: 'Invitation revoked',
    onConfirm: async () => {
      await revokeAccountInvite(account.id);
      setAccounts(previous => previous.filter(item => item.id !== account.id));
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
      onConfirm: async () => updateStoredAccount(await toggleAccountStatus(account.id)),
    });
  };

  const columns = useMemo<TableColumn<Account>[]>(() => {
    const accountColumns: TableColumn<Account>[] = [
      {
        key: 'name',
        header: 'Name',
        render: account => `${account.firstName} ${account.lastName}`,
      },
      { key: 'email', header: 'Email', render: account => account.email },
      { key: 'role', header: 'Role', width: '110px', render: account => titleCase(account.role) },
      { key: 'status', header: 'Status', width: '120px', render: account => statusBadge(account.status) },
      {
        key: 'createdAt',
        header: 'Created',
        width: '150px',
        render: account => formatShortDate(account.createdAt),
      },
    ];

    if (!canWrite) return accountColumns;

    return [...accountColumns, {
      key: 'actions',
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
              if (categoryId === 'status') setStatusFilters(selected as AccountStatus[]);
              if (categoryId === 'role') setRoleFilters(selected as AccountRole[]);
            }}
            onClearAll={() => {
              setStatusFilters([]);
              setRoleFilters([]);
            }}
          />}
        />

        <section className="accounts-panel" aria-label="Accounts">
          <Table
            ariaLabel="Accounts"
            columns={columns}
            data={accounts}
            loading={loading}
            error={error}
            emptyMessage={search || statusFilters.length || roleFilters.length ? 'No accounts match these filters' : 'No accounts found'}
            keyExtractor={account => account.id}
          />
        </section>
      </main>

      {isAdmin && canWrite && modalTarget !== null && (
        <AccountModal
          isOpen
          account={modalTarget !== 'new' && modalTarget !== null ? modalTarget : undefined}
          onClose={() => setModalTarget(null)}
          onSuccess={account => {
            setAccounts(previous => previous.some(item => item.id === account.id)
              ? previous.map(item => item.id === account.id ? account : item)
              : [...previous, account]);
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
              setAccounts(previous => [...previous, {
                id: youth.id,
                firstName: youth.firstName,
                lastName: youth.lastName,
                email: account.email,
                role: 'youth',
                status: account.status,
                createdAt: youth.createdAt,
              }]);
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
