import { useState, useEffect } from 'react';
import { getErrorMessage } from '../utils/errors';
import { getToken } from '../utils/storage';
import { getUsers } from '../../pages/Users/api/users.api';

interface StaffUser {
  id: string;
  firstName: string;
  lastName: string;
}

export const useStaff = () => {
  const [staff, setStaff] = useState<StaffUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadStaff = async () => {
    setLoading(true);
    setError('');

    try {
      const data = await getUsers(getToken());
      setStaff(data);
    } catch (err: unknown) {
      setError(getErrorMessage(err, 'Failed to fetch staff users'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadStaff();
  }, []);

  return {
    staff,
    loading,
    error,
    refetch: loadStaff,
  };
};
