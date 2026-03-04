import { useState, useEffect } from 'react';
import { getYouth } from '../api/youth.api';
import { getErrorMessage } from '../../../common/utils/errors';

export interface YouthProfile {
  id: string;
  firstName: string;
  lastName: string;
  active: boolean;
  dateOfBirth: string | null;
  schoolId: string | null;
  schoolName: string | null;
  gradeLevel: number | null;
  ageGroup: 'junior_youth' | 'senior_youth' | null;
  createdAt: string;
  addresses: Array<{
    id: string;
    address: string;
    city: string;
    province: string;
    postalCode: string;
    country: string;
  }> | null;
  contacts: Array<{
    id: string;
    firstName: string;
    lastName: string;
    phoneNumber: string | null;
    type: string;
  }> | null;
}

export function useYouth() {
  const [youth, setYouth] = useState<YouthProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadYouth = async () => {
    setLoading(true);
    setError('');

    try {
      const data = await getYouth();
      setYouth(data);
    } catch (err: unknown) {
      setError(getErrorMessage(err, 'Failed to load youth profiles'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadYouth();
  }, []);

  return { youth, setYouth, loading, error, refetch: loadYouth };
}
