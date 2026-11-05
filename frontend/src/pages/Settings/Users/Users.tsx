import { useMemo, useState } from 'react';
import { useAuth } from '../../../auth/authContext';
import PageContainer from '../../../common/components/PageContainer/PageContainer';
import Button from '../../../common/components/Button/Button';
import ActionsMenu from '../../../common/components/ActionsMenu/ActionsMenu';
import ConfirmModal from '../../../common/components/ConfirmModal/ConfirmModal';
import { type PageMessageValue } from '../../../common/components/PageMessageOverlay/PageMessageOverlay';
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
    roles: filters.values.roles,
    statuses: filters.values.statuses,
  } : null, [search.appliedValue, controlsReady, filters.values.roles, filters.values.statuses]);

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
      <PageContainer
        title="Users"
        className="manage-accounts-page"
        ariaLabel="Account records"
        controls={controls}
        loadingLabel="Loading saved account preferences…"
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
        search={{
          label: 'Search accounts',
          placeholder: 'Search by name or email',
          availableWhileLoading: true,
        }}
        columns={columns}
        messages={[preferencesError, viewError]}
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
      />

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
