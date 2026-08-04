import { useCallback, useEffect, useRef, useState } from 'react';
import { getSessions } from '../../../../common/api/cohorts.api';
import type { CohortSession, SessionListFilters } from '../../../../common/types/cohort';
import { getErrorMessage } from '../../../../common/utils/clientErrors';

export function useSessions({
  programIds = [],
  cohortId,
  sessionTypeIds = [],
  statuses = [],
  search,
}: SessionListFilters, enabled = true) {
  const [sessions, setSessions] = useState<CohortSession[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const requestIdRef = useRef(0);

  const refresh = useCallback(async () => {
    if (!enabled) return;
    const requestId = ++requestIdRef.current;
    setLoading(true);
    setError(null);
    try {
      const data = await getSessions({
        programIds,
        cohortId,
        sessionTypeIds,
        statuses,
        search,
      });
      if (requestIdRef.current === requestId) setSessions(data);
    } catch (cause) {
      if (requestIdRef.current === requestId) {
        setError(getErrorMessage(cause, 'Could not load sessions'));
      }
    } finally {
      if (requestIdRef.current === requestId) setLoading(false);
    }
  }, [cohortId, enabled, programIds, search, sessionTypeIds, statuses]);

  useEffect(() => {
    if (!enabled) {
      requestIdRef.current += 1;
      setSessions([]);
      setLoading(false);
      setError(null);
      return;
    }
    void refresh();
    return () => {
      requestIdRef.current += 1;
    };
  }, [enabled, refresh]);

  return { sessions, loading, error, refresh };
}
