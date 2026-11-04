import type { YouthAttendanceResult } from '../youthAttendance.api';
import { useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import type { AttendanceStatus } from '../../../../../common/features/AttendanceStatusSelect/types';
import { useSubmitStatus } from '../../../../../common/hooks/useSubmitStatus';
import { getErrorMessage } from '../../../../../http/errors';
import { getYouthProgramCycleAttendance, setYouthProgramCycleAttendance } from '../youthAttendance.api';
import type { YouthProgramCycleAttendance } from '../types';

export default function useYouthAttendance({
  youthId,
  programId,
  cycleId,
  onSaved,
}: {
  youthId: string | null;
  programId: string | null;
  cycleId: string | null;
  onSaved: (result: YouthAttendanceResult) => void | Promise<void>;
}) {
  const queryClient = useQueryClient();
  const [selections, setSelections] = useState<Record<string, AttendanceStatus | ''>>({});
  const { submitStatus, setSubmitStatus, error, setError, resetStatus } = useSubmitStatus();
  const queryKey = ['youth-program-cycle-attendance', youthId, programId, cycleId];
  const query = useQuery({
    queryKey,
    queryFn: ({ signal }) => getYouthProgramCycleAttendance(youthId!, { programId: programId!, cycleId: cycleId! }, { signal }),
    enabled: Boolean(youthId && programId && cycleId),
  });

  useEffect(() => {
    resetStatus();
    setSelections({});
  }, [programId, cycleId, resetStatus, youthId]);

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
    if (!youthId || !programId || !cycleId || !query.data) return;
    setSubmitStatus('submitting');
    setError('');
    try {
      const saved = await setYouthProgramCycleAttendance(
        youthId,
        { programId, cycleId },
        query.data.sessions.map(session => ({
          sessionId: session.id,
          status: selections[session.id] || null,
          notes: session.notes,
        })),
      );
      queryClient.setQueryData<YouthProgramCycleAttendance>(queryKey, saved);
      await onSaved(saved);
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
