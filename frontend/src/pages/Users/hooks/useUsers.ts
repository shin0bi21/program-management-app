import { useState, useEffect } from 'react';
import { getErrorMessage } from '../../../common/utils/errors';
import { getToken } from '../../../common/utils/storage';
import { getUsers } from '../api/users.api';

interface User {
  id: string;
  firstName: string;
  lastName: string;
}

export const useUsers = () => {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadUsers = async () => {
    setLoading(true);
    setError('');

    try {
      const data = await getUsers(getToken());
      setUsers(data);
    } catch (err: unknown) {
      setError(getErrorMessage(err, 'Failed to fetch users'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadUsers();
  }, []);

  return {
    users,
    loading,
    error,
    refreshUsers: loadUsers,
  };
};
