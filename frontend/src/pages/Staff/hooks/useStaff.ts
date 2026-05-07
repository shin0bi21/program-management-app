import { useState, useEffect } from 'react';
import { getErrorMessage } from '../../../common/utils/clientErrors';
import { getStaff } from '../api/staff.api';
import type { StaffUser } from '../types';

export type { StaffUser };

export const useStaff = () => {
  const [staff, setStaff] = useState<StaffUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadStaff = async () => {
    setLoading(true);
    setError('');

    try {
      const data = await getStaff();
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
