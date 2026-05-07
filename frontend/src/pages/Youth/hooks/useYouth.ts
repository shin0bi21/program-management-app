import { useState, useEffect } from 'react';
import { getYouth } from '../api/youth.api';
import { getErrorMessage } from '../../../common/utils/clientErrors';
import type { YouthProfile } from '../types';

export type { YouthProfile };

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
