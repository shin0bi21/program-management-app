import { useCycleReferences, useProgramReferences } from '../../../../common/features/referenceData/hooks/useReferenceData';

/**
 * Supplies the page's shared program and cycle choices.
 * @param assignedOnly - Whether program choices are limited to the current staff assignments.
 * @returns Reference choices with independent request feedback.
 * @example const { programs, cycles } = useYouthData(true)
 */
export default function useYouthData(assignedOnly: boolean) {
  const programs = useProgramReferences({ assignedOnly });
  const cycles = useCycleReferences();

  return {
    programs: programs.rows,
    programsLoading: programs.loading,
    programsError: programs.error,
    cycles: cycles.rows,
    cyclesLoading: cycles.loading,
    cyclesError: cycles.error,
  };
}
