import { useQuery, type UseQueryResult } from '@tanstack/react-query';
import {
  getCycleReferences,
  getProgramReferences,
  getSchoolReferences,
  getStaffReferences,
  type CycleReference,
  type ProgramReference,
  type SchoolReference,
  type StaffReference,
  type StaffReferenceFeature,
} from '../referenceData.api';

export type ReferenceDataQuery<T> = Pick<UseQueryResult<T>, 'data' | 'isLoading' | 'error'>;

export const referenceDataKeys = {
  cycles: ['reference-data', 'cycles'] as const,
  sessionScheduling: ['reference-data', 'session-scheduling'] as const,
  programs: (assignedOnly = false) => ['reference-data', 'programs', { assignedOnly }] as const,
  staff: (feature: StaffReferenceFeature) => ['reference-data', 'staff', feature] as const,
  schools: ['reference-data', 'schools'] as const,
};

export function useCycleReferences(): UseQueryResult<CycleReference[]> {
  return useQuery({
    queryKey: referenceDataKeys.cycles,
    queryFn: ({ signal }) => getCycleReferences({ signal }),
  });
}

export function useProgramReferences({ assignedOnly = false }: { assignedOnly?: boolean } = {}): UseQueryResult<ProgramReference[]> {
  return useQuery({
    queryKey: referenceDataKeys.programs(assignedOnly),
    queryFn: ({ signal }) => getProgramReferences({ assignedOnly }, { signal }),
  });
}

export function useStaffReferences(feature: StaffReferenceFeature): UseQueryResult<StaffReference[]> {
  return useQuery({
    queryKey: referenceDataKeys.staff(feature),
    queryFn: ({ signal }) => getStaffReferences(feature, { signal }),
  });
}

export function useSchoolReferences(): UseQueryResult<SchoolReference[]> {
  return useQuery({
    queryKey: referenceDataKeys.schools,
    queryFn: ({ signal }) => getSchoolReferences({ signal }),
  });
}
