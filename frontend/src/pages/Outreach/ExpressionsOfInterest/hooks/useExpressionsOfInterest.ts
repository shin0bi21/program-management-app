import { useEffect, useState } from 'react';
import { getErrorMessage } from '../../../../common/utils/clientErrors';
import { getExpressionsOfInterest } from '../api/expressionsOfInterest.api';
import type { ExpressionOfInterest, ExpressionOfInterestFilters } from '../types';

export function useExpressionsOfInterest(filters: ExpressionOfInterestFilters | null) {
  const [submissions, setSubmissions] = useState<ExpressionOfInterest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      if (!filters) return;
      setLoading(true);
      setError(null);
      try {
        setSubmissions(await getExpressionsOfInterest(filters));
      } catch (err) {
        setError(getErrorMessage(err, 'Failed to load expressions of interest'));
      } finally {
        setLoading(false);
      }
    };

    if (filters) void load();
  }, [filters?.search, filters?.statuses, filters?.programIds]);

  return { submissions, setSubmissions, loading, error };
}
