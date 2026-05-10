import { useState } from 'react';
import Header from '../../common/components/Header/Header';
import Button from '../../common/components/Button/Button';
import Table, { TableColumn } from '../../common/components/Table/Table';
import { useStaff, StaffUser } from './hooks/useStaff';
import { useAuth } from '../../common/context/AuthContext';
import StaffModal from './components/StaffModal/StaffModal';
import './Staff.css';

export default function Staff() {
  const { staff, setStaff, loading, error } = useStaff();
  const { permissions } = useAuth();
  const canInvite = permissions.includes('write:staff');
  const [modalOpen, setModalOpen] = useState(false);

  const handleInviteSuccess = (newStaff: StaffUser) => {
    setStaff((prev) => [...prev, newStaff]);
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
          onClose={() => setModalOpen(false)}
          onSuccess={handleInviteSuccess}
        />
      )}
    </>
  );
}
