import { useCycleReferences, useProgramReferences, useSchoolReferences } from '../../../../common/features/referenceData/hooks/useReferenceData';
import { getErrorMessage } from '../../../../http/errors';

/**
 * Supplies the page's shared program, cycle, and school choices.
 * @param assignedOnly - Whether program choices are limited to the current staff assignments.
 * @returns Reference choices with independent request feedback.
 * @example const { programs, cycles } = useYouthData(true)
 */
export default function useYouthData(assignedOnly: boolean) {
  const programs = useProgramReferences({ assignedOnly });
  const cycles = useCycleReferences();
  const schools = useSchoolReferences();

  return {
    programs: programs.data ?? [],
    programsLoading: programs.isLoading,
    programsError: programs.error ? getErrorMessage(programs.error, 'Could not load programs') : '',
    cycles: cycles.data ?? [],
    cyclesLoading: cycles.isLoading,
    cyclesError: cycles.error ? getErrorMessage(cycles.error, 'Could not load cycles') : '',
    schools: schools.data ?? [],
    schoolsLoading: schools.isLoading,
    schoolsError: schools.error ? getErrorMessage(schools.error, 'Could not load schools') : '',
  };
}
