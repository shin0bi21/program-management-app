import { useCycleReferences, useProgramReferences } from '../../../../common/features/referenceData/hooks/useReferenceData';
import { createRecordStore } from '../../../../query/createRecordStore';
import type { ListSort } from '../../../../common/components/Table/Table.types';
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

export const youthData = createRecordStore<YouthProfile>({
  queryKey: ['youth', 'records'],
  listKey: ['youth', 'table'],
  getSortValue: (profile, queryKey) => {
    const sorting = queryKey[queryKey.length - 1] as ListSort<YouthSortKey>;
    return getYouthSortValue(profile, sorting.key);
  },
});

/**
 * Supplies the page's current saved Youth profiles and shared program/cycle choices.
 * @param assignedOnly - Whether program choices are limited to the current staff assignments.
 * @returns Complete profiles indexed by ID and reference choices with independent request feedback.
 * @example const { records, programs, cycles } = useYouthData(true)
 */
export default function useYouthData(assignedOnly: boolean) {
  const records = youthData.useRecords();
  const programs = useProgramReferences({ assignedOnly });
  const cycles = useCycleReferences();

  return {
    records,
    programs: programs.rows,
    programsLoading: programs.loading,
    programsError: programs.error,
    cycles: cycles.rows,
    cyclesLoading: cycles.loading,
    cyclesError: cycles.error,
  };
}
