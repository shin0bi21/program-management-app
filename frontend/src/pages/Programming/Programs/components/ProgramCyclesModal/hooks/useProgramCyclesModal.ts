import { useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';

import { setProgramCycles } from '../../../api/programs.api';
import useSubmitLock from '../../../../../../common/hooks/useSubmitLock';
import type { SubmitStatus } from '../../../../../../common/hooks/useSubmitStatus';
import { getErrorMessage } from '../../../../../../http/errors';
import { getProgramCycleAssignments } from '../../../api/programCycleAssignments.api';
import { syncProgramCycleAssignmentChanges } from '../../../hooks/actions/programCycleAssignmentCache';

/**
 * Edits assigned cycles for the program draft owned by this keyed modal instance.
 * @param programId - Program whose assignments are loaded and saved.
 * @param cyclesReady - Whether selectable cycle reference data is available.
 * @example useProgramCyclesModal('program-1', true) // one program's assigned-cycle draft
 */
export default function useProgramCyclesModal(programId: string, cyclesReady: boolean) {
  const queryClient = useQueryClient();
  const assignments = useQuery({
    queryKey: ['programs', 'cycle-assignment-editor', programId],
    queryFn: ({ signal }) => getProgramCycleAssignments(programId, { includeAllPrograms: true }, { signal }),
    staleTime: 0,
  });
  const [selectedCycleIds, setSelectedCycleIds] = useState<string[] | null>(null);
  const [submitStatus, setSubmitStatus] = useState<SubmitStatus>('idle');
  const [statusMessage, setStatusMessage] = useState('');
  const { tryLock, unlock } = useSubmitLock();

  useEffect(() => {
    if (!assignments.data) return;
    setSelectedCycleIds(current => current ?? assignments.data.map(programCycle => programCycle.cycleId));
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

      syncProgramCycleAssignmentChanges(queryClient, saved);

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
