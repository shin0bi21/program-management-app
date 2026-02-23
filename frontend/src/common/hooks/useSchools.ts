import { useState, useEffect } from 'react';
import { getSchools } from '../../pages/Users/api/youth.api';
import { getToken } from '../utils/storage';

export interface School {
  id: string;
  name: string;
  schoolType: string;
  board: string | null;
}

export function useSchools() {
  const [schools, setSchools] = useState<School[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadSchools = async () => {
    setLoading(true);
    setError('');

    try {
      const token = getToken();
      const data = await getSchools(token);
      setSchools(data);
    } catch (err: unknown) {
      setError('Failed to load schools');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSchools();
  }, []);

  return { schools, loading, error, refetch: loadSchools };
}
