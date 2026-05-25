import { useState, useMemo } from 'react';
import Header from '../../common/components/Header/Header';
import Button from '../../common/components/Button/Button';
import Modal from '../../common/components/Modal/Modal';
import Table, { TableColumn } from '../../common/components/Table/Table';
import ActionsMenu from '../../common/components/ActionsMenu/ActionsMenu';
import { ConfirmAction, useConfirmModal } from '../../common/hooks/useConfirmModal';
import { useStaff, StaffUser } from './hooks/useStaff';
import { useAuth } from '../../common/context/AuthContext';
import StaffModal from './components/StaffModal/StaffModal';
import { deleteStaff, toggleStaffActive } from '../../common/api/staff.api';
import './Staff.css';

function statusBadge(status: StaffUser['status']) {
  if (status === 'invited')  return <span className="status-badge status-invited">Invited</span>;
  if (status === 'active')   return <span className="status-badge status-active">Active</span>;
  return <span className="status-badge status-inactive">Inactive</span>;
}

export default function Staff() {
  const { staff, setStaff, loading, error } = useStaff();
  const { permissions } = useAuth();
  const canInvite = permissions.includes('write:staff');
  const [modalTarget, setModalTarget] = useState<StaffUser | 'new' | null>(null);
  const [confirmAction, setConfirmAction] = useState<ConfirmAction | null>(null);

  const handleModalSuccess = (user: StaffUser) => {
    setStaff(prev => {
      const exists = prev.some(s => s.id === user.id);
      return exists ? prev.map(s => s.id === user.id ? user : s) : [...prev, user];
    });
  };

  const handleModalClose = () => setModalTarget(null);

  const handleEditStaff = (user: StaffUser) => setModalTarget(user);

  const handleRevokeInvite = (user: StaffUser) => setConfirmAction({
    title: 'Revoke Invite',
    message: `Revoke the invite for ${user.firstName} ${user.lastName}? They will be removed and will need to be re-invited.`,
    confirmLabel: 'Revoke',
    confirmVariant: 'danger',
    successMessage: 'User successfully deleted',
    onConfirm: async () => {
      await deleteStaff(user.id);
      setStaff(prev => prev.filter(s => s.id !== user.id));
    },
  });

  const handleDeactivateStaff = (user: StaffUser) => setConfirmAction({
    title: 'Deactivate User',
    message: `Deactivate ${user.firstName} ${user.lastName}? They will lose access to the system immediately.`,
    confirmLabel: 'Deactivate',
    confirmVariant: 'danger',
    onConfirm: async () => {
      const updated = await toggleStaffActive(user.id);
      setStaff(prev => prev.map(s => s.id === updated.id ? updated : s));
    },
  });

  const handleReactivateStaff = (user: StaffUser) => setConfirmAction({
    title: 'Reactivate User',
    message: `Reactivate ${user.firstName} ${user.lastName}? They will regain access to the system.`,
    confirmLabel: 'Reactivate',
    confirmVariant: 'primary',
    onConfirm: async () => {
      const updated = await toggleStaffActive(user.id);
      setStaff(prev => prev.map(s => s.id === updated.id ? updated : s));
    },
  });

  const confirmModal = useConfirmModal({
    action: confirmAction,
    onClose: () => setConfirmAction(null),
  });

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
      className: 'col-actions',
      width: '32px',
      render: (user) => (
        <ActionsMenu
          items={[
            { label: 'Edit', onClick: () => handleEditStaff(user) },
            ...(user.status === 'invited'  ? [{ label: 'Revoke Invite',  variant: 'danger' as const, onClick: () => handleRevokeInvite(user) }]    : []),
            ...(user.status === 'active'   ? [{ label: 'Deactivate',     variant: 'danger' as const, onClick: () => handleDeactivateStaff(user) }] : []),
            ...(user.status === 'inactive' ? [{ label: 'Reactivate',                                 onClick: () => handleReactivateStaff(user) }] : []),
          ]}
        />
      ),
    };

    return canInvite ? [...baseColumns, actionColumn] : baseColumns;
  }, [canInvite]);

  return (
    <>
      <Header />
      <div className="page-container">
        <div className="page-header">
          <div className="page-title-row">
            <h1 className="page-title">Manage Staff</h1>
            {canInvite && (
              <Button onClick={() => setModalTarget('new')}>+ Invite Staff</Button>
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
          isOpen={modalTarget !== null}
          onClose={handleModalClose}
          onSuccess={handleModalSuccess}
          staffData={modalTarget !== 'new' && modalTarget !== null ? modalTarget : undefined}
        />
      )}

      {confirmAction && (
        <Modal
          isOpen
          onClose={() => setConfirmAction(null)}
          title={confirmAction.title}
          status={confirmModal.status}
          statusMessage={confirmModal.statusMessage}
          footer={confirmModal.footer}
          disableClose={confirmModal.disableClose}
          successDelay={confirmModal.successDelay}
        >
          <p>{confirmAction.message}</p>
        </Modal>
      )}
    </>
  );
}
