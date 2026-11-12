import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';

import { useCycleReferences, useProgramReferences, useStaffReferences } from '../../../../../common/features/referenceData/hooks/useReferenceData';
import { getHoursReferenceData } from '../../hours.api';

/**
 * Supplies shared staff, program, cycle, and hour choices.
 * @param referenceDataQueryKey - Cache key for hour categories and source types.
 * @param currentUserId - Signed-in staff member used to resolve the default staff member.
 * @example const { staff, cycles } = useHoursData(['hours-reference-data'], userId)
 */
export default function useHoursData(
  referenceDataQueryKey: readonly unknown[],
  currentUserId?: string,
) {
  const referenceDataQuery = useQuery({
    queryKey: referenceDataQueryKey,
    queryFn: ({ signal }) => getHoursReferenceData({ signal }),
  });
  const cyclesQuery = useCycleReferences();
  const programsQuery = useProgramReferences();
  const staffQuery = useStaffReferences('hours');
  const staff = staffQuery.rows;
  const writableStaff = useMemo(
    () => staff.filter(staffMember => staffMember.writable),
    [staff],
  );
  const staffById = useMemo(
    () => new Map(staff.map(staffMember => [staffMember.id, staffMember])),
    [staff],
  );

  return {
    staff,
    writableStaff,
    staffById,
    programs: programsQuery.rows,
    categories: referenceDataQuery.data?.categories ?? [],
    types: referenceDataQuery.data?.types ?? [],
    currentUserStaff: currentUserId ? staffById.get(currentUserId) ?? null : null,
    optionsLoading: referenceDataQuery.isLoading || programsQuery.loading || staffQuery.loading,
    optionsError: referenceDataQuery.error || programsQuery.error || staffQuery.error,
    staffError: staffQuery.error,
    programsError: programsQuery.error,
    localOptionsError: referenceDataQuery.error,
    cycles: cyclesQuery.rows,
    cyclesLoading: cyclesQuery.loading,
    cyclesError: cyclesQuery.error,
  };
}
