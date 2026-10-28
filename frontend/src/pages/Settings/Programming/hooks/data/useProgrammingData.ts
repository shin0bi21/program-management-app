import { useQueryClient } from '@tanstack/react-query';
import type { Program } from '../../../../../common/features/programs/types';
import { referenceDataKeys, useCycleReferences } from '../../../../../common/features/referenceData/hooks/useReferenceData';
import { usePrograms } from '../../../../../common/features/programs/hooks/usePrograms';

export default function useProgrammingData() {
  const queryClient = useQueryClient();
  const programs = usePrograms();
  const cycles = useCycleReferences();

  const upsertProgram = (program: Program) => {
    programs.upsertProgram(program);
    void queryClient.invalidateQueries({ queryKey: referenceDataKeys.programs(false) });
    void queryClient.invalidateQueries({ queryKey: referenceDataKeys.programs(true) });
    void queryClient.invalidateQueries({ queryKey: referenceDataKeys.sessionScheduling });
  };

  return {
    programs: programs.programs,
    upsertProgram,
    programsLoading: programs.loading,
    programsError: programs.error,
    retryPrograms: programs.retry,
    cycles: cycles.rows,
    cyclesLoading: cycles.loading,
    cyclesError: cycles.error,
    refreshCycles: cycles.refetch,
    removeCycle: cycles.remove,
  };
}
