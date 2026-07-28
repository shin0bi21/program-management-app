import { useCallback, useEffect, useRef, useState } from 'react';
import { getManagedSessions } from '../../../../common/api/cohorts.api';
import type { ManagedSession, SessionListFilters } from '../../../../common/types/cohort';
import { getErrorMessage } from '../../../../common/utils/clientErrors';

export function useManagedSessions({
  programIds = [],
  cohortId,
  sessionTypeIds = [],
  statuses = [],
  search,
}: SessionListFilters) {
  const [sessions, setSessions] = useState<ManagedSession[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const requestIdRef = useRef(0);

  const refresh = useCallback(async () => {
    const requestId = ++requestIdRef.current;
    setLoading(true);
    setError(null);
    try {
      const data = await getManagedSessions({
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
  }, [cohortId, programIds, search, sessionTypeIds, statuses]);

  useEffect(() => {
    void refresh();
    return () => {
      requestIdRef.current += 1;
    };
  }, [refresh]);

  return { sessions, loading, error, refresh };
}
