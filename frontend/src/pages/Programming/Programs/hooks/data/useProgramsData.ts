import { useProgramCycleAssignments } from './useProgramCycleAssignments';
import { useCycleReferences, useProgramReferences } from '../../../../../common/features/referenceData/hooks/useReferenceData';

/**
 * Supplies shared choices and assignment rows used by program statuses and editors.
 * The table owns program rows; the dashboard owns its selected-program summary.
 * @param canWritePrograms - Loads the full assignment collection for editors when permitted.
 * @example const { programs, cycles } = useProgramsData()
 */
export default function useProgramsData(canWritePrograms = false) {
  const programs = useProgramReferences({ assignedOnly: true });
  const cycles = useCycleReferences();

  const assignments = useProgramCycleAssignments(undefined, true, canWritePrograms);

  return {
    assignments,
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
