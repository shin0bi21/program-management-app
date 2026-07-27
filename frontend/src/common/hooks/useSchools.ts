import { useState, useEffect } from 'react';
import { getSchools } from '../api/schools.api';
import type { School } from '../types/school';
import { getErrorMessage } from '../utils/clientErrors';

export type { School };

export function useSchools() {
  const [schools, setSchools] = useState<School[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadSchools = async () => {
    setLoading(true);
    setError('');

    try {
      const data = await getSchools();
      setSchools(data);
    } catch (cause) {
      setError(getErrorMessage(cause, 'Failed to load schools'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSchools();
  }, []);

  return { schools, setSchools, loading, error, refetch: loadSchools };
}
