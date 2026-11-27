import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';

import {
  useCycleReferences,
  useProgramReferences,
  useStaffReferences,
  type ReferenceDataQuery,
} from '../../../../../common/features/referenceData/hooks/useReferenceData';
import type { CycleReference, ProgramReference, StaffReference } from '../../../../../common/features/referenceData/referenceData.api';
import { getHoursReferenceData, type HoursReferenceData } from '../../hours.api';
import type { Hours } from '../../types';

type HoursDataResult = {
  staff: ReferenceDataQuery<StaffReference[]>;
  programs: ReferenceDataQuery<ProgramReference[]>;
  cycles: ReferenceDataQuery<CycleReference[]>;
  referenceData: ReferenceDataQuery<HoursReferenceData>;
  writableStaff: StaffReference[];
  staffById: ReadonlyMap<Hours['staffId'], StaffReference>;
  currentUserStaff: StaffReference | null;
};

/**
 * Supplies shared staff, program, cycle, and hour choices.
 * @param referenceDataQueryKey - Cache key for hour categories and source types.
 * @param currentUserId - Signed-in staff member used to resolve the default staff member.
 * @example const { staff, cycles } = useHoursData(['hours-reference-data'], userId)
 */
export default function useHoursData(
  referenceDataQueryKey: readonly unknown[],
  currentUserId?: string,
): HoursDataResult {
  const referenceData = useQuery({
    queryKey: referenceDataQueryKey,
    queryFn: ({ signal }) => getHoursReferenceData({ signal }),
  });
  const cycles = useCycleReferences();
  const programs = useProgramReferences();
  const staff = useStaffReferences('hours');
  const writableStaff = useMemo(
    () => (staff.data ?? []).filter(staffMember => staffMember.writable),
    [staff.data],
  );
  const staffById = useMemo(
    () => new Map((staff.data ?? []).map(staffMember => [staffMember.id, staffMember])),
    [staff.data],
  );

  return {
    staff,
    programs,
    cycles,
    referenceData,
    writableStaff,
    staffById,
    currentUserStaff: currentUserId ? staffById.get(currentUserId) ?? null : null,
  };
}
