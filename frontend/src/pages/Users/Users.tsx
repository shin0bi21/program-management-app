import { useState } from 'react';
import Header from '../../common/components/Header/Header';
import { useUsers } from './hooks/useUsers';
import './Users.css';

type TabType = 'staff' | 'youth';

export default function Users() {
  const [activeTab, setActiveTab] = useState<TabType>('staff');
  const { users, loading, error } = useUsers();

  return (
    <>
      <Header />
      <div className="users-container">
        <div className="users-header">
          <h1 className="users-title">Users</h1>
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
            {loading && <div className="users-loading">Loading...</div>}
            {error && <div className="users-error">{error}</div>}

            {!loading && !error && (
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

            {!loading && !error && users.length === 0 && (
              <div className="users-empty">No staff users found</div>
            )}
          </>
        )}

        {activeTab === 'youth' && (
          <div className="users-placeholder">
            <p>Youth profiles coming soon</p>
            <p className="users-placeholder-subtitle">Staff will be able to create and manage youth profiles here</p>
          </div>
        )}
      </div>
    </>
  );
}
