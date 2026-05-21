import { useState, useMemo } from 'react';
import Header from '../../common/components/Header/Header';
import Button from '../../common/components/Button/Button';
import Modal from '../../common/components/Modal/Modal';
import Table, { TableColumn } from '../../common/components/Table/Table';
import ActionsMenu from '../../common/components/ActionsMenu/ActionsMenu';
import { useStaff, StaffUser } from './hooks/useStaff';
import { useAuth } from '../../common/context/AuthContext';
import StaffModal from './components/StaffModal/StaffModal';
import { deleteStaff, toggleStaffActive } from './api/staff.api';
import { getErrorMessage } from '../../common/utils/clientErrors';
import './Staff.css';

type ConfirmAction =
  | { type: 'revoke'; user: StaffUser }
  | { type: 'deactivate'; user: StaffUser }
  | { type: 'reactivate'; user: StaffUser };

function confirmLabel(action: ConfirmAction): string {
  const name = `${action.user.firstName} ${action.user.lastName}`;
  if (action.type === 'revoke') return `Revoke the invite for ${name}? They will be removed and will need to be re-invited.`;
  if (action.type === 'deactivate') return `Deactivate ${name}? They will lose access to the system immediately.`;
  return `Reactivate ${name}? They will regain access to the system.`;
}

function confirmButtonLabel(action: ConfirmAction): string {
  if (action.type === 'revoke') return 'Revoke';
  if (action.type === 'deactivate') return 'Deactivate';
  return 'Reactivate';
}

function confirmTitle(action: ConfirmAction): string {
  if (action.type === 'revoke') return 'Revoke Invite';
  if (action.type === 'deactivate') return 'Deactivate User';
  return 'Reactivate User';
}

function statusBadge(status: StaffUser['status']) {
  if (status === 'invited')  return <span className="status-badge status-invited">Invited</span>;
  if (status === 'active')   return <span className="status-badge status-active">Active</span>;
  return <span className="status-badge status-inactive">Inactive</span>;
}

export default function Staff() {
  const { staff, setStaff, loading, error } = useStaff();
  const { permissions } = useAuth();
  const canInvite = permissions.includes('write:staff');
  const [modalOpen, setModalOpen] = useState(false);
  const [staffToEdit, setStaffToEdit] = useState<StaffUser | undefined>(undefined);
  const [confirmAction, setConfirmAction] = useState<ConfirmAction | null>(null);
  const [confirmError, setConfirmError] = useState('');
  const [confirmSuccess, setConfirmSuccess] = useState('');
  const [confirming, setConfirming] = useState(false);

  const closeConfirm = () => {
    setConfirmAction(null);
    setConfirmError('');
    setConfirmSuccess('');
  };

  const handleModalSuccess = (user: StaffUser) => {
    setStaff((prev) => {
      const exists = prev.some((s) => s.id === user.id);
      return exists ? prev.map((s) => (s.id === user.id ? user : s)) : [...prev, user];
    });
  };

  const handleModalClose = () => {
    setModalOpen(false);
    setStaffToEdit(undefined);
  };

  const handleConfirm = async () => {
    if (!confirmAction) return;
    setConfirming(true);
    setConfirmError('');
    try {
      if (confirmAction.type === 'revoke') {
        await deleteStaff(confirmAction.user.id);
        setStaff((prev) => prev.filter((s) => s.id !== confirmAction.user.id));
        setConfirmSuccess('User successfully deleted');
        setTimeout(closeConfirm, 1500);
      } else {
        const updated = await toggleStaffActive(confirmAction.user.id);
        setStaff((prev) => prev.map((s) => (s.id === updated.id ? updated : s)));
        setConfirmAction(null);
      }
    } catch (err) {
      setConfirmError(getErrorMessage(err, 'Action failed'));
    } finally {
      setConfirming(false);
    }
  };

  const staffColumns = useMemo<TableColumn<StaffUser>[]>(() => {
    const baseColumns: TableColumn<StaffUser>[] = [
      { key: 'firstName', header: 'First Name', render: (user) => user.firstName },
      { key: 'lastName',  header: 'Last Name',  render: (user) => user.lastName },
      { key: 'email',     header: 'Email',       render: (user) => user.email },
      { key: 'role',      header: 'Role',        render: (user) => user.role.charAt(0).toUpperCase() + user.role.slice(1) },
      { key: 'status',    header: 'Status',      render: (user) => statusBadge(user.status) },
    ];

    // key: 'actions' as const is required to satisfy TableColumn's key constraint
    const actionColumn: TableColumn<StaffUser> = {
      key: 'actions' as const,
      header: '',
      width: '140px',
      render: (user) => (
        <ActionsMenu
          disabled={confirming}
          items={[
            { label: 'Edit', onClick: () => { setStaffToEdit(user); setModalOpen(true); } },
            ...(user.status === 'invited'  ? [{ label: 'Revoke Invite', onClick: () => setConfirmAction({ type: 'revoke',     user }), variant: 'danger' as const }] : []),
            ...(user.status === 'active'   ? [{ label: 'Deactivate',    onClick: () => setConfirmAction({ type: 'deactivate', user }), variant: 'danger' as const }] : []),
            ...(user.status === 'inactive' ? [{ label: 'Reactivate',    onClick: () => setConfirmAction({ type: 'reactivate', user }) }] : []),
          ]}
        />
      ),
    };

    return canInvite ? [...baseColumns, actionColumn] : baseColumns;
  }, [canInvite, confirming]);

  return (
    <>
      <Header />
      <div className="page-container">
        <div className="page-header">
          <div className="page-title-row">
            <h1 className="page-title">Manage Staff</h1>
            {canInvite && (
              <Button onClick={() => { setStaffToEdit(undefined); setModalOpen(true); }}>+ Invite Staff</Button>
            )}
          </div>
        </div>

        <Table
          columns={staffColumns}
          data={staff}
          loading={loading}
          error={error}
          emptyMessage="No staff users found"
          keyExtractor={(user) => user.id}
          maxHeight="calc(100vh - 200px)"
        />
      </div>

      {canInvite && (
        <StaffModal
          isOpen={modalOpen}
          onClose={handleModalClose}
          onSuccess={handleModalSuccess}
          staffData={staffToEdit}
        />
      )}

      {confirmAction && (
        <Modal
          isOpen
          onClose={closeConfirm}
          title={confirmTitle(confirmAction)}
          status={confirmSuccess ? 'success' : confirmError ? 'error' : undefined}
          statusMessage={confirmSuccess || confirmError || undefined}
          footer={
            <>
              <Button variant="secondary" onClick={closeConfirm} disabled={confirming}>
                Cancel
              </Button>
              <Button
                variant={confirmAction.type === 'reactivate' ? 'primary' : 'danger'}
                onClick={handleConfirm}
                disabled={confirming}
              >
                {confirming ? 'Please wait...' : confirmButtonLabel(confirmAction)}
              </Button>
            </>
          }
        >
          <p>{confirmLabel(confirmAction)}</p>
        </Modal>
      )}
    </>
  );
}
