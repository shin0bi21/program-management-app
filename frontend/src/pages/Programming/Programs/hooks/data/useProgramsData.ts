import { useCycleReferences, useProgramReferences } from '../../../../../common/features/referenceData/hooks/useReferenceData';

/**
 * Supplies shared program and cycle choices for page filters and forms.
 * Tables and dashboard cards own their complete query results.
 * @example const { programs, cycles } = useProgramsData()
 */
export default function useProgramsData() {
  const programs = useProgramReferences({ assignedOnly: true });
  const cycles = useCycleReferences();

  return {
    programs: programs.rows,
    programsLoading: programs.loading,
    programsError: programs.error,
    retryPrograms: programs.refetch,
    cycles: cycles.rows,
    cyclesLoading: cycles.loading,
    cyclesError: cycles.error,
    retryCycles: cycles.refetch,
    removeCycle: cycles.remove,
  };
}
