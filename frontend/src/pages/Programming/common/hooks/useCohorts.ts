import { useCallback, useEffect, useRef, useState } from 'react';
import { getCohorts } from '../../../../common/api/cohorts.api';
import type { ProgramCohort } from '../../../../common/types/cohort';
import { getErrorMessage } from '../../../../common/utils/clientErrors';

export function useCohorts(programId?: string) {
  const [cohorts, setCohorts] = useState<ProgramCohort[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const requestIdRef = useRef(0);

  const refresh = useCallback(async () => {
    const requestId = ++requestIdRef.current;
    setLoading(true);
    setError(null);
    try {
      const data = await getCohorts(programId);
      if (requestIdRef.current === requestId) setCohorts(data);
    } catch (cause) {
      if (requestIdRef.current === requestId) {
        setError(getErrorMessage(cause, 'Could not load cohorts'));
      }
    } finally {
      if (requestIdRef.current === requestId) setLoading(false);
    }
  }, [programId]);

  useEffect(() => {
    void refresh();
    return () => {
      requestIdRef.current += 1;
    };
  }, [refresh]);

  return { cohorts, loading, error, refresh };
}
