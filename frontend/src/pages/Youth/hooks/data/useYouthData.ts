import { useCycleReferences, useProgramReferences } from '../../../../common/features/referenceData/hooks/useReferenceData';
import type { YouthProfile, YouthSortKey } from '../../types';

/**
 * Supplies the server-compatible value for a Youth table order.
 * @param profile - Complete saved Youth profile.
 * @param key - Column selected for ordering.
 * @example getYouthSortValue(profile, 'firstName') // lower-case first name
 */
export function getYouthSortValue(profile: YouthProfile, key: YouthSortKey) {
  return {
    firstName: profile.firstName.toLowerCase(),
    lastName: profile.lastName.toLowerCase(),
    dateOfBirth: profile.dateOfBirth ?? '',
    school: profile.schoolName?.toLowerCase() ?? '',
    activeProgram: profile.activeProgram?.program.toLowerCase() ?? '',
  }[key];
}

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
