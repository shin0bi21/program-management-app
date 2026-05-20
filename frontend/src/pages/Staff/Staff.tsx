import { useState } from 'react';
import Header from '../../common/components/Header/Header';
import Button from '../../common/components/Button/Button';
import Table, { TableColumn } from '../../common/components/Table/Table';
import { useStaff, StaffUser } from './hooks/useStaff';
import { useAuth } from '../../common/context/AuthContext';
import StaffModal from './components/StaffModal/StaffModal';
import { deleteStaff } from './api/staff.api';
import { getErrorMessage } from '../../common/utils/clientErrors';
import './Staff.css';

export default function Staff() {
  const { staff, setStaff, loading, error } = useStaff();
  const { permissions } = useAuth();
  const canInvite = permissions.includes('write:staff');
  const [modalOpen, setModalOpen] = useState(false);
  const [staffToEdit, setStaffToEdit] = useState<StaffUser | undefined>(undefined);

  const handleInviteSuccess = (newStaff: StaffUser) => {
    setStaff((prev) => [...prev, newStaff]);
  };

  const handleEditSuccess = (updatedStaff: StaffUser) => {
    setStaff((prev) => prev.map((s) => (s.id === updatedStaff.id ? updatedStaff : s)));
  };

  const handleRescindInvite = async (staffUser: StaffUser) => {
    if (!confirm(`Are you sure you want to rescind the invite for ${staffUser.firstName} ${staffUser.lastName}?`)) {
      return;
    }

    try {
      await deleteStaff(staffUser.id);
      setStaff((prev) => prev.filter((s) => s.id !== staffUser.id));
    } catch (err) {
      alert(getErrorMessage(err, 'Failed to rescind invite'));
    }
  };

  const handleEditClick = (staffUser: StaffUser) => {
    setStaffToEdit(staffUser);
    setModalOpen(true);
  };

  const handleModalClose = () => {
    setModalOpen(false);
    setStaffToEdit(undefined);
  };

  const staffColumns: TableColumn<StaffUser>[] = [
    {
      key: 'firstName',
      header: 'First Name',
      render: (user) => user.firstName,
    },
    {
      key: 'lastName',
      header: 'Last Name',
      render: (user) => user.lastName,
    },
    {
      key: 'email',
      header: 'Email',
      render: (user) => user.email,
    },
    {
      key: 'role',
      header: 'Role',
      render: (user) => user.role,
    },
    {
      key: 'active',
      header: 'Status',
      render: (user) => (
        <span className={`status-badge ${user.active ? 'status-active' : 'status-invited'}`}>
          {user.active ? 'Active' : 'Invited'}
        </span>
      ),
    },
    {
      key: 'actions',
      header: 'Actions',
      render: (user) => canInvite ? (
        <div style={{ display: 'flex', gap: '8px' }}>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => handleEditClick(user)}
          >
            Edit
          </Button>
          {!user.active && (
            <Button
              variant="secondary"
              size="sm"
              onClick={() => handleRescindInvite(user)}
            >
              Rescind
            </Button>
          )}
        </div>
      ) : null,
      width: '180px',
    },
  ];

  return (
    <>
      <Header />
      <div className="page-container">
        <div className="page-header">
          <div className="page-title-row">
            <h1 className="page-title">Manage Staff</h1>
            {canInvite && (
              <Button onClick={() => setModalOpen(true)}>+ Invite Staff</Button>
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
          onSuccess={staffToEdit ? handleEditSuccess : handleInviteSuccess}
          staffData={staffToEdit}
        />
      )}
    </>
  );
}
