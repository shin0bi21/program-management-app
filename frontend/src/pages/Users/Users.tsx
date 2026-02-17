import { useState } from 'react';
import Header from '../../common/components/Header/Header';
import Table, { TableColumn } from '../../common/components/Table/Table';
import { useUsers } from './hooks/useUsers';
import { useYouth } from './hooks/useYouth';
import YouthModal from './components/YouthModal';
import type { YouthProfile } from './hooks/useYouth';
import './Users.css';

type TabType = 'staff' | 'youth';

function calculateAge(dateOfBirth: string | null): string {
  if (!dateOfBirth) return 'N/A';
  const today = new Date();
  const birthDate = new Date(dateOfBirth);
  let age = today.getFullYear() - birthDate.getFullYear();
  const monthDiff = today.getMonth() - birthDate.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
    age--;
  }
  return age.toString();
}

export default function Users() {
  const [activeTab, setActiveTab] = useState<TabType>('staff');
  const [showAddYouth, setShowAddYouth] = useState(false);
  const [youthToEdit, setYouthToEdit] = useState<YouthProfile | undefined>(undefined);
  const { users, loading: usersLoading, error: usersError } = useUsers();
  const { youth, setYouth, loading: youthLoading, error: youthError, refetch: refetchYouth } = useYouth();

  // Staff table columns
  const staffColumns: TableColumn<typeof users[number]>[] = [
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
  ];

  // Youth table columns
  const youthColumns: TableColumn<YouthProfile>[] = [
    {
      key: 'firstName',
      header: 'First Name',
      render: (profile) => profile.firstName,
    },
    {
      key: 'lastName',
      header: 'Last Name',
      render: (profile) => profile.lastName,
    },
    {
      key: 'age',
      header: 'Age',
      render: (profile) => calculateAge(profile.dateOfBirth),
      width: '80px',
    },
    {
      key: 'school',
      header: 'School',
      render: (profile) => profile.schoolName ?? 'N/A',
    },
    {
      key: 'grade',
      header: 'Grade',
      render: (profile) => profile.gradeLevel ?? 'N/A',
      width: '100px',
    },
    {
      key: 'active',
      header: 'Status',
      render: (profile) => (
        <span className={`status-badge ${profile.active ? 'status-active' : 'status-inactive'}`}>
          {profile.active ? 'Active' : 'Inactive'}
        </span>
      ),
      width: '100px',
    },
    {
      key: 'actions',
      header: 'Actions',
      render: (profile) => (
        <button
          className="users-action-btn"
          onClick={() => {
            setYouthToEdit(profile);
            setShowAddYouth(true);
          }}
        >
          Edit
        </button>
      ),
      width: '100px',
    },
  ];

  return (
    <>
      <Header />
      <div className="users-container">
        <div className="users-header">
          <div className="users-title-row">
            <h1 className="users-title">Users</h1>
            {activeTab === 'youth' && (
              <button className="users-add-btn" onClick={() => setShowAddYouth(true)}>
                + Add Youth
              </button>
            )}
          </div>
          <div className="users-tabs">
            <button
              className={`users-tab ${activeTab === 'staff' ? 'active' : ''}`}
              onClick={() => setActiveTab('staff')}
            >
              Staff
            </button>
            <button
              className={`users-tab ${activeTab === 'youth' ? 'active' : ''}`}
              onClick={() => setActiveTab('youth')}
            >
              Youth
            </button>
          </div>
        </div>

        {activeTab === 'staff' && (
          <Table
            columns={staffColumns}
            data={users}
            loading={usersLoading}
            error={usersError}
            emptyMessage="No staff users found"
            keyExtractor={(user) => user.id}
            maxHeight="calc(100vh - 200px)"
          />
        )}

        {activeTab === 'youth' && (
          <Table
            columns={youthColumns}
            data={youth}
            loading={youthLoading}
            error={youthError}
            emptyMessage="No youth profiles found"
            keyExtractor={(profile) => profile.id}
            maxHeight="calc(100vh - 200px)"
          />
        )}
      </div>

      <YouthModal
        isOpen={showAddYouth}
        youthData={youthToEdit}
        onClose={() => {
          setShowAddYouth(false);
          setYouthToEdit(undefined);
        }}
        onSuccess={(savedYouth) => {
          setShowAddYouth(false);
          setYouthToEdit(undefined);
          
          // Update local state instead of refetching
          if (youthToEdit) {
            // Update existing youth
            setYouth(youth.map(y => y.id === savedYouth.id ? savedYouth : y));
          } else {
            // Add new youth
            setYouth([...youth, savedYouth]);
          }
        }}
      />
    </>
  );
}
