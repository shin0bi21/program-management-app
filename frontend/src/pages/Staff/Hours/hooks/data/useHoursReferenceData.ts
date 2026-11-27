import { useQuery } from '@tanstack/react-query';

import {
  useCycleReferences,
  useProgramReferences,
  useStaffReferences,
  type ReferenceDataQuery,
} from '../../../../../common/features/referenceData/hooks/useReferenceData';
import type { CycleReference, ProgramReference, StaffReference } from '../../../../../common/features/referenceData/referenceData.api';
import { getHoursReferenceData, type HoursReferenceData } from '../../hours.api';

export type HoursReferences = {
  staff: ReferenceDataQuery<StaffReference[]>;
  programs: ReferenceDataQuery<ProgramReference[]>;
  cycles: ReferenceDataQuery<CycleReference[]>;
  hoursOptions: ReferenceDataQuery<HoursReferenceData>;
};

/**
 * Supplies shared staff, program, cycle, and hour choices.
 * @example const { staff, cycles } = useHoursReferenceData()
 */
export default function useHoursReferenceData(): HoursReferences {
  const hoursOptions = useQuery({
    queryKey: ['hours-reference-data'],
    queryFn: ({ signal }) => getHoursReferenceData({ signal }),
  });
  const cycles = useCycleReferences();
  const programs = useProgramReferences();
  const staff = useStaffReferences('hours');
  return {
    staff,
    programs,
    cycles,
    hoursOptions,
  };
}
