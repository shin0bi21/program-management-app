import { useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';

import { setProgramCycles } from '../../../../../../common/features/programs/programs.api';
import useSubmitLock from '../../../../../../common/hooks/useSubmitLock';
import type { SubmitStatus } from '../../../../../../common/hooks/useSubmitStatus';
import { getErrorMessage } from '../../../../../../http/errors';
import { getCohorts } from '../../../../../Programming/Cohorts/cohorts.api';

// The modal is keyed by program ID, so each instance owns one program draft.
export default function useProgramCyclesModal(programId: string, cyclesReady: boolean) {
  const queryClient = useQueryClient();
  const assignments = useQuery({
    queryKey: ['cohorts', 'program-cycle-assignments', programId],
    queryFn: ({ signal }) => getCohorts(programId, { includeAllPrograms: true }, { signal }),
    staleTime: 0,
  });
  const [selectedCycleIds, setSelectedCycleIds] = useState<string[] | null>(null);
  const [submitStatus, setSubmitStatus] = useState<SubmitStatus>('idle');
  const [statusMessage, setStatusMessage] = useState('');
  const { tryLock, unlock } = useSubmitLock();

  useEffect(() => {
    if (!assignments.data) return;
    setSelectedCycleIds(current => current ?? assignments.data.map(cohort => cohort.cycleId));
  }, [assignments.data]);

  const locked = submitStatus === 'submitting' || submitStatus === 'success';
  const ready = cyclesReady && selectedCycleIds !== null && !assignments.isError && !assignments.isFetching;

  const toggleCycle = (cycleId: string) => {
    if (locked || !ready) return;
    setSelectedCycleIds(current => current && (current.includes(cycleId)
      ? current.filter(id => id !== cycleId)
      : [...current, cycleId]));
  };

  const submit = async () => {
    if (!ready || selectedCycleIds === null || !tryLock()) return;

    setSubmitStatus('submitting');
    setStatusMessage('Saving assigned cycles...');

    try {
      const saved = await setProgramCycles(programId, selectedCycleIds);
      // Every cohort consumer, including operational options, must observe the new relationships.
      void queryClient.invalidateQueries({ queryKey: ['cohorts'] });

      setSelectedCycleIds(saved.cycleIds);
      setSubmitStatus('success');
      setStatusMessage('Assigned cycles saved.');
    } catch (cause) {
      setStatusMessage(getErrorMessage(cause, 'Could not save assigned cycles'));
      setSubmitStatus('error');
      unlock();
    }
  };

  return {
    selectedCycleIds,
    locked,
    ready,
    loading: assignments.isPending || assignments.isFetching,
    error: assignments.isError ? getErrorMessage(assignments.error, 'Could not load assigned cycles') : null,
    retry: () => { void assignments.refetch(); },
    submitStatus,
    statusMessage: statusMessage || undefined,
    toggleCycle,
    submit,
  };
}
