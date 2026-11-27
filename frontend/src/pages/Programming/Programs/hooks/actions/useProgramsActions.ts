import { useCallback, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { removeInfiniteListRow, replaceInfiniteListRow } from '../../../../../query/infiniteListCache';
import type { Program } from '../../types';
import { referenceDataKeys } from '../../../../../common/features/referenceData/hooks/useReferenceData';

import type { ConfirmAction } from '../../../../../common/components/ConfirmModal/types';
import { deleteProgramCycle, type SetCycleResult } from '../../api/cycles.api';
import type { ProgramMutationResult } from '../../api/programs.api';
import { CYCLE_TABLE_QUERY_KEY } from '../../components/CycleTable/queryKeys';
import { syncProgramCycleAssignmentChanges } from './programCycleAssignmentCache';
import type { ProgramCycle } from '../../../../../common/features/programming/cycles/types';

interface UseProgramsActionsOptions {
  programTableQueryKey: readonly unknown[];
  onProgramSynced: (program: Program) => void;
}

/**
 * Reconciles saved programs and cycles with their loaded queries.
 * @param options - Table cache key and callback for saved programs.
 * @example useProgramsActions({ programTableQueryKey, onProgramSynced })
 */
export default function useProgramsActions({ programTableQueryKey, onProgramSynced }: UseProgramsActionsOptions) {
  const queryClient = useQueryClient();
  const [confirmAction, setConfirmAction] = useState<ConfirmAction | null>(null);

  const syncProgram = (result: ProgramMutationResult, operation: 'create' | 'update') => {
    const { program } = result;
    if (operation === 'create') {
      void queryClient.invalidateQueries({ queryKey: programTableQueryKey });
    } else {
      replaceInfiniteListRow(queryClient, programTableQueryKey, program);
      onProgramSynced(program);
    }

    void queryClient.invalidateQueries({ queryKey: ['programs', 'options'] });
    syncProgramCycleAssignmentChanges(queryClient, result);
    void queryClient.invalidateQueries({ queryKey: referenceDataKeys.programs(false) });
    void queryClient.invalidateQueries({ queryKey: referenceDataKeys.programs(true) });
    void queryClient.invalidateQueries({ queryKey: referenceDataKeys.sessionScheduling });
  };

  const syncCycle = (result: SetCycleResult, operation: 'create' | 'update') => {
    if (operation === 'create') {
      void queryClient.invalidateQueries({ queryKey: CYCLE_TABLE_QUERY_KEY });
    } else {
      replaceInfiniteListRow(queryClient, CYCLE_TABLE_QUERY_KEY, result.cycle);
    }
    syncProgramCycleAssignmentChanges(queryClient, result);
    const choices = queryClient.getQueryData<ProgramCycle[]>(referenceDataKeys.cycles);
    if (choices) {
      queryClient.setQueryData(referenceDataKeys.cycles, choices.some(cycle => cycle.id === result.cycle.id)
        ? choices.map(cycle => cycle.id === result.cycle.id ? result.cycle : cycle)
        : [...choices, result.cycle]);
    } else {
      void queryClient.invalidateQueries({ queryKey: referenceDataKeys.cycles });
    }
  };

  const requestCycleDeletion = useCallback((cycle: ProgramCycle) => {
    setConfirmAction({
      title: 'Delete Cycle',
      message: `Delete ${cycle.title}? Cycles assigned to programs or logged hours cannot be deleted.`,
      confirmVariant: 'danger',
      successMessage: 'Cycle deleted',
      onConfirm: async () => {
        await deleteProgramCycle(cycle.id);

        removeInfiniteListRow(queryClient, CYCLE_TABLE_QUERY_KEY, cycle.id);
        queryClient.setQueryData<ProgramCycle[]>(referenceDataKeys.cycles, current => (
          (current ?? []).filter(choice => choice.id !== cycle.id)
        ));
      },
    });
  }, [queryClient]);

  const closeConfirmation = useCallback(() => setConfirmAction(null), []);

  return { syncProgram, confirmAction, requestCycleDeletion, syncCycle, closeConfirmation };
}
