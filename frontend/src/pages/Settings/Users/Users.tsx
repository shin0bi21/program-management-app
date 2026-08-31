import { useState } from 'react';
import { useAuth } from '../../../auth/authContext';
import Button from '../../../common/components/Button/Button';
import ActionsMenu from '../../../common/components/ActionsMenu/ActionsMenu';
import ColumnVisibilityMenu from '../../../common/components/ColumnVisibilityMenu/ColumnVisibilityMenu';
import ConfirmModal from '../../../common/components/ConfirmModal/ConfirmModal';
import FilterCard from '../../../common/components/FilterCard/FilterCard';
import PageErrorOverlay, { type PageErrorItem } from '../../../common/components/PageErrorOverlay/PageErrorOverlay';
import PageBody from '../../../common/components/PageBody/PageBody';
import PageHeader from '../../../common/components/PageHeader/PageHeader';
import SearchInput from '../../../common/components/SearchInput/SearchInput';
import YouthModal from '../../../common/features/youth/components/YouthModal/YouthModal';
import { ACCOUNT_TABLE_KEYS } from '../../../common/types/account';
import AccountModal from './components/AccountModal/AccountModal';
import UserTable from './components/UserTable/UserTable';
import useUserTable from './components/UserTable/hooks/useUserTable';
import useAccountActions from './hooks/actions/useAccountActions';
import { useAccountControls } from './hooks/useAccountControls';
import useAccountModals from './hooks/useAccountModals';
import './Users.css';

const ACCOUNTS_TABLE_QUERY_KEY = ['accounts', 'table'] as const;

export default function Users() {
  // Page-local errors.
  const [viewError, setViewError] = useState<PageErrorItem | null>(null);

  // Permissions and services.
  const { role, permissions } = useAuth();
  const isAdmin = role === 'admin';
  const canWrite = permissions.includes('write:accounts');
  const canInviteYouth = permissions.includes('write:youth_profiles');

  // Page data and preferences.
  const controls = useAccountControls(isAdmin, ACCOUNT_TABLE_KEYS);
  const {
    search, setSearch, appliedSearch, applySearch, clearSearch, queryFilters, statusFilters, roleFilters, sorting,
    columnWidths, hiddenColumns, error: preferenceError, filterCategories,
    hasActiveQueryFilters, ready: controlsReady,
  } = controls;

  // Page-spanning account actions and cache reconciliation.
  const { revokeInvite, toggleStatus, syncSavedAccount, syncYouthInvitation } = useAccountActions({
    accountTableQueryKey: ACCOUNTS_TABLE_QUERY_KEY,
  });

  // Account, youth-invitation, and confirmation modal workflows.
  const modals = useAccountModals({ revokeInvite, toggleStatus });

  // Table configuration.
  const { columns } = useUserTable({
    canWrite,
    isAdmin,
    onEdit: modals.account.open,
    onRevoke: modals.confirmation.requestRevoke,
    onToggleStatus: modals.confirmation.requestStatusToggle,
  });

  // Render.
  return (
    <>
      <main className="page-container page-container--data manage-accounts-page">
        <PageHeader
          title="Users"
          actions={(
            <div className="users-actions">
              {isAdmin && canWrite && canInviteYouth ? (
                <ActionsMenu
                  triggerLabel="+ Add"
                  items={[
                    { id: 'invite-staff', label: 'Invite Staff', onClick: modals.account.openNew },
                    { id: 'invite-youth', label: 'Invite Youth', onClick: modals.youthInvite.show },
                  ]}
                />
              ) : canInviteYouth ? (
                <Button onClick={modals.youthInvite.show}>+ Add</Button>
              ) : isAdmin && canWrite ? (
                <Button onClick={modals.account.openNew}>+ Add</Button>
              ) : null}
            </div>
          )}
          search={<SearchInput
            label="Search accounts"
            value={search}
            appliedValue={appliedSearch}
            onChange={event => setSearch(event.target.value)}
            onApply={applySearch}
            onClear={clearSearch}
            placeholder="Search by name or email"
          />}
          columns={controlsReady ? <ColumnVisibilityMenu columns={columns} hiddenColumnKeys={hiddenColumns} onHiddenColumnKeysChange={controls.setHiddenColumns} /> : undefined}
          filters={controlsReady ? <FilterCard
            categories={filterCategories}
            values={{ status: statusFilters, role: roleFilters }}
            onApply={controls.applyFilter}
            onClearAll={controls.clearFilters}
          /> : undefined}
        />
        <PageErrorOverlay errors={[preferenceError, viewError]} />

        {!controlsReady ? <p role="status">Loading saved account preferences…</p> : <PageBody
          ariaLabel="Account records"
          dashboard={null}
          table={<UserTable
            queryKey={ACCOUNTS_TABLE_QUERY_KEY}
            filters={queryFilters}
            columns={columns}
            hiddenColumnKeys={hiddenColumns}
            hasActiveQueryFilters={hasActiveQueryFilters}
            sorting={sorting}
            onSortingChange={controls.setSorting}
            columnWidths={columnWidths}
            onColumnWidthsChange={controls.setColumnWidths}
            onErrorChange={setViewError}
          />}
        />}
      </main>

      {isAdmin && canWrite && modals.account.target !== null && (
        <AccountModal
          isOpen
          account={modals.account.target !== 'new' ? modals.account.target : undefined}
          onClose={modals.account.close}
          onSuccess={savedAccount => syncSavedAccount(savedAccount, modals.account.target === 'new')}
        />
      )}

      {modals.youthInvite.open && (
        <YouthModal
          isOpen
          showLoginEmail
          onClose={modals.youthInvite.close}
          onSuccess={syncYouthInvitation}
        />
      )}

      <ConfirmModal
        action={modals.confirmation.action}
        onClose={modals.confirmation.close}
      />
    </>
  );
}
