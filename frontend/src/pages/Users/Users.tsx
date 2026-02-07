import { useState, useEffect } from 'react';
import Header from '../../common/components/Header/Header';
import { getErrorMessage } from '../../common/utils/errors';
import { getToken } from '../../common/utils/storage';
import { fetchAllUsers } from './api/users.api';
import './Users.css';

interface User {
  id: string;
  firstName: string;
  lastName: string;
}

export default function Users() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    try {
      const data = await fetchAllUsers(getToken());
      setUsers(data);
    } catch (err: unknown) {
      setError(getErrorMessage(err, 'Failed to fetch users'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Header />
      <div className="users-container">
        <h1 className="users-title">Users</h1>

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
          <div className="users-empty">No users found</div>
        )}
      </div>
    </>
  );
}
