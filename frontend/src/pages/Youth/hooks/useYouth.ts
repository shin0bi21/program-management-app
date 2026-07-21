import { useState, useEffect } from 'react';
import { getYouth } from '../../../common/api/youth.api';
import { getErrorMessage } from '../../../common/utils/clientErrors';
import type { YouthProfile } from '../types';
import type { YouthFilters } from '../../../common/types/youth';

export type { YouthProfile };

export function useYouth(filters: YouthFilters = {}) {
  const [youth, setYouth] = useState<YouthProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadYouth = async () => {
    setLoading(true);
    setError('');

    try {
      const data = await getYouth(undefined, filters);
      setYouth(data);
    } catch (err: unknown) {
      setError(getErrorMessage(err, 'Failed to load youth profiles'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadYouth();
  }, [filters.search, filters.statuses, filters.programIds]);

  return { youth, setYouth, loading, error, refetch: loadYouth };
}
