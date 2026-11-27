import { useProgramCycleAssignments } from './useProgramCycleAssignments';
import { useCycleReferences, useProgramReferences } from '../../../../../common/features/referenceData/hooks/useReferenceData';
import { getErrorMessage } from '../../../../../http/errors';

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
    programs: programs.data ?? [],
    programsLoading: programs.isLoading,
    programsError: programs.error ? getErrorMessage(programs.error, 'Could not load programs') : '',
    retryPrograms: async () => { await programs.refetch(); },
    cycles: cycles.data ?? [],
    cyclesLoading: cycles.isLoading,
    cyclesError: cycles.error ? getErrorMessage(cycles.error, 'Could not load cycles') : '',
    retryCycles: async () => { await cycles.refetch(); },
  };
}
