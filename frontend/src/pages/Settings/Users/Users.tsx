import { useMemo, useState } from 'react';
import { useAuth } from '../../../auth/authContext';
import Button from '../../../common/components/Button/Button';
import ActionsMenu from '../../../common/components/ActionsMenu/ActionsMenu';
import ColumnVisibilityMenu from '../../../common/components/ColumnVisibilityMenu/ColumnVisibilityMenu';
import ConfirmModal from '../../../common/components/ConfirmModal/ConfirmModal';
import FilterCard from '../../../common/components/FilterCard/FilterCard';
import PageMessageOverlay, { type PageMessageValue } from '../../../common/components/PageMessageOverlay/PageMessageOverlay';
import PageBody from '../../../common/components/PageBody/PageBody';
import PageHeader from '../../../common/components/PageHeader/PageHeader';
import SearchInput from '../../../common/components/SearchInput/SearchInput';
import SchoolModal from '../../../common/features/SchoolModal/SchoolModal';
import useSchoolModal from '../../../common/features/SchoolModal/hooks/useSchoolModal';
import YouthModal from '../../Youth/components/YouthModal/YouthModal';
import { USER_TABLE_KEYS, type UserFilters } from './types';
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
  const [viewError, setViewError] = useState<PageMessageValue>(null);

  // Permissions and services.
  const { role, permissions } = useAuth();
  const isAdmin = role === 'admin';
  const canWrite = permissions.includes('write:accounts');
  const canInviteYouth = permissions.includes('write:youth_profiles');

  // Page data and preferences.
  const controls = useAccountControls(isAdmin, USER_TABLE_KEYS);
  const { search, filters, table, ready: controlsReady, error: preferencesError } = controls;

  // Filter configuration.
  const accountFilters = useMemo<UserFilters | null>(() => controlsReady ? {
    search: search.appliedValue,
    roles: filters.roles,
    statuses: filters.statuses,
  } : null, [search.appliedValue, controlsReady, filters.roles, filters.statuses]);

  // Page-spanning account actions and cache reconciliation.
  const { revokeInvite, toggleStatus, syncSavedAccount, syncYouthInvitation } = useAccountActions({
    accountTableQueryKey: ACCOUNTS_TABLE_QUERY_KEY,
  });

  // Account, youth-invitation, and confirmation modal workflows.
  const modals = useAccountModals({ revokeInvite, toggleStatus });
  const schoolModal = useSchoolModal();
  const closeYouthInvite = () => {
    schoolModal.close();
    modals.youthInvite.close();
  };

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
      <main className="page-container manage-accounts-page">
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
            value={search.value}
            appliedValue={search.appliedValue}
            onChange={event => search.setValue(event.target.value)}
            onApply={search.apply}
            onClear={search.clear}
            placeholder="Search by name or email"
          />}
          columns={controlsReady ? <ColumnVisibilityMenu columns={columns} hiddenColumnKeys={table.hiddenColumns} onHiddenColumnKeysChange={table.setHiddenColumns} /> : undefined}
          filters={controlsReady ? <FilterCard
            categories={filters.definitions}
            values={{ status: filters.statuses, role: filters.roles }}
            onApply={filters.apply}
            onClearAll={filters.clear}
          /> : undefined}
        />
        <PageMessageOverlay messages={[preferencesError, viewError]} />

        {!controlsReady ? <p role="status">Loading saved account preferences…</p> : <PageBody
          ariaLabel="Account records"
          dashboard={null}
          table={<UserTable
            queryKey={ACCOUNTS_TABLE_QUERY_KEY}
            filters={accountFilters}
            columns={columns}
            hiddenColumnKeys={table.hiddenColumns}
            sorting={table.sorting}
            onSortingChange={table.setSorting}
            columnWidths={table.columnWidths}
            onColumnWidthsChange={table.setColumnWidths}
            onMessageChange={setViewError}
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
          inviteYouth
          suspended={schoolModal.action !== null}
          onManageSchool={schoolModal.open}
          onClose={closeYouthInvite}
          onSuccess={syncYouthInvitation}
        />
      )}

      <SchoolModal workflow={schoolModal} />
      <ConfirmModal
        action={modals.confirmation.action}
        onClose={modals.confirmation.close}
      />
    </>
  );
}
