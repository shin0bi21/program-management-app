import { useState } from 'react';
import Header from '../../common/components/Header/Header';
import { useUsers } from './hooks/useUsers';
import { useYouth } from './hooks/useYouth';
import AddYouthModal from './components/AddYouthModal';
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
  const { users, loading: usersLoading, error: usersError } = useUsers();
  const { youth, loading: youthLoading, error: youthError, refetch: refetchYouth } = useYouth();

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
          <>
            {usersLoading && <div className="users-loading">Loading...</div>}
            {usersError && <div className="users-error">{usersError}</div>}

            {!usersLoading && !usersError && (
              <table className="users-table">
                <thead>
                  <tr>
                    <th>First Name</th>
                    <th>Last Name</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((user) => (
                    <tr key={user.id}>
                      <td>{user.firstName}</td>
                      <td>{user.lastName}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}

            {!usersLoading && !usersError && users.length === 0 && (
              <div className="users-empty">No staff users found</div>
            )}
          </>
        )}

        {activeTab === 'youth' && (
          <>
            {youthLoading && <div className="users-loading">Loading...</div>}
            {youthError && <div className="users-error">{youthError}</div>}

            {!youthLoading && !youthError && (
              <table className="users-table">
                <thead>
                  <tr>
                    <th>First Name</th>
                    <th>Last Name</th>
                    <th>Age</th>
                    <th>School</th>
                    <th>Grade</th>
                    <th>Active</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {youth.map((profile) => (
                    <tr key={profile.id}>
                      <td>{profile.firstName}</td>
                      <td>{profile.lastName}</td>
                      <td>{calculateAge(profile.dateOfBirth)}</td>
                      <td>{profile.schoolName ?? 'N/A'}</td>
                      <td>{profile.gradeLevel ?? 'N/A'}</td>
                      <td>
                        <span className={`status-badge ${profile.active ? 'status-active' : 'status-inactive'}`}>
                          {profile.active ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td>
                        <button className="users-action-btn">View</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}

            {!youthLoading && !youthError && youth.length === 0 && (
              <div className="users-empty">No youth profiles found</div>
            )}
          </>
        )}
      </div>

      <AddYouthModal
        isOpen={showAddYouth}
        onClose={() => setShowAddYouth(false)}
        onSuccess={() => {
          setShowAddYouth(false);
          refetchYouth();
        }}
      />
    </>
  );
}
