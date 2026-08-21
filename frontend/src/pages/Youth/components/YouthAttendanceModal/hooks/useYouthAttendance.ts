import { useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import type { AttendanceStatus } from '../../../../../common/types/cohort';
import { useSubmitStatus } from '../../../../../common/hooks/useSubmitStatus';
import { getErrorMessage } from '../../../../../http/errors';
import { getYouthCohortAttendance, setYouthCohortAttendance } from '../youthAttendance.api';
import type { YouthCohortAttendance } from '../types';

export default function useYouthAttendance({
  youthId,
  cohortId,
  onSaved,
}: {
  youthId: string | null;
  cohortId: string | null;
  onSaved: () => void | Promise<void>;
}) {
  const queryClient = useQueryClient();
  const [selections, setSelections] = useState<Record<string, AttendanceStatus | ''>>({});
  const { submitStatus, setSubmitStatus, error, setError, resetStatus } = useSubmitStatus();
  const queryKey = ['youth-cohort-attendance', youthId, cohortId];
  const query = useQuery({
    queryKey,
    queryFn: ({ signal }) => getYouthCohortAttendance(youthId!, cohortId!, { signal }),
    enabled: Boolean(youthId && cohortId),
  });

  useEffect(() => {
    resetStatus();
    setSelections({});
  }, [cohortId, resetStatus, youthId]);

  useEffect(() => {
    if (!query.data) return;
    setSelections(Object.fromEntries(
      query.data.sessions.map(session => [session.id, session.status ?? '']),
    ));
  }, [query.data]);

  const updateStatus = (sessionId: string, status: AttendanceStatus | '') => {
    setSelections(current => ({ ...current, [sessionId]: status }));
  };

  const save = async () => {
    if (!youthId || !cohortId || !query.data) return;
    setSubmitStatus('submitting');
    setError('');
    try {
      const saved = await setYouthCohortAttendance(
        youthId,
        cohortId,
        query.data.sessions.map(session => ({
          sessionId: session.id,
          status: selections[session.id] || null,
          notes: session.notes,
        })),
      );
      queryClient.setQueryData<YouthCohortAttendance>(queryKey, saved);
      await onSaved();
      setSubmitStatus('success');
    } catch (cause) {
      setError(getErrorMessage(cause, 'Could not save youth attendance'));
      setSubmitStatus('error');
    }
  };

  return {
    attendance: query.data,
    loading: query.isLoading,
    loadError: query.error ? getErrorMessage(query.error, 'Could not load youth attendance') : '',
    refresh: query.refetch,
    selections,
    updateStatus,
    save,
    submitStatus,
    error,
  };
}
