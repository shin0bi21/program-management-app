import { useEffect, useState } from 'react';
import { getErrorMessage } from '../../../../common/utils/clientErrors';
import { getCohortInterestSubmissions } from '../api/cohortInterest.api';
import type { CohortInterestSubmission } from '../types';

export function useCohortInterest() {
  const [submissions, setSubmissions] = useState<CohortInterestSubmission[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        setSubmissions(await getCohortInterestSubmissions());
      } catch (err) {
        setError(getErrorMessage(err, 'Failed to load cohort submissions'));
      } finally {
        setLoading(false);
      }
    };

    load();
  }, []);

  return { submissions, loading, error };
}
