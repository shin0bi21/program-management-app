import { useState, useEffect } from 'react';
import { getSchools } from '../../../common/api/schools.api';
import { getErrorMessage } from '../../../common/utils/clientErrors';
import type { School } from '../types';

export function useSchools() {
  const [schools, setSchools] = useState<School[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadSchools = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getSchools();
      setSchools(data);
    } catch (err: unknown) {
      setError(getErrorMessage(err, 'Failed to load schools'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSchools();
  }, []);

  return { schools, loading, error, refetch: loadSchools, setSchools };
}
