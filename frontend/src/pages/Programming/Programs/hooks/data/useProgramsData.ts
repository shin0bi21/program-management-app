import { useCycleReferences } from '../../../../../common/features/referenceData/hooks/useReferenceData';
import { usePrograms } from '../../../../../common/features/programs/hooks/usePrograms';

export default function useProgramsData() {
  const programs = usePrograms({ assignedOnly: true });
  const cycles = useCycleReferences();

  return {
    programs: programs.programs,
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
