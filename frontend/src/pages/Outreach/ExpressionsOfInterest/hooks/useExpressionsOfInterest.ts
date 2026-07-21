import { useEffect, useState } from 'react';
import { getErrorMessage } from '../../../../common/utils/clientErrors';
import { getExpressionsOfInterest } from '../api/expressionsOfInterest.api';
import type { ExpressionOfInterest } from '../types';

export function useExpressionsOfInterest() {
  const [submissions, setSubmissions] = useState<ExpressionOfInterest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        setSubmissions(await getExpressionsOfInterest());
      } catch (err) {
        setError(getErrorMessage(err, 'Failed to load expressions of interest'));
      } finally {
        setLoading(false);
      }
    };

    load();
  }, []);

  return { submissions, loading, error };
}
