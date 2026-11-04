import useListQuery from '../../../../query/hooks/useListQuery';
import {
  getCycleReferences,
  getProgramReferences,
  getSchoolReferences,
  getStaffReferences,
  type StaffReferenceFeature,
} from '../referenceData.api';

export const referenceDataKeys = {
  cycles: ['reference-data', 'cycles'] as const,
  sessionScheduling: ['reference-data', 'session-scheduling'] as const,
  programs: (assignedOnly = false) => ['reference-data', 'programs', { assignedOnly }] as const,
  staff: (feature: StaffReferenceFeature) => ['reference-data', 'staff', feature] as const,
  schools: ['reference-data', 'schools'] as const,
};

export function useCycleReferences() {
  return useListQuery({
    queryKey: referenceDataKeys.cycles,
    queryFn: ({ signal }) => getCycleReferences({ signal }),
    errorMessage: 'Could not load cycles',
  });
}

export function useProgramReferences({ assignedOnly = false }: { assignedOnly?: boolean } = {}) {
  return useListQuery({
    queryKey: referenceDataKeys.programs(assignedOnly),
    queryFn: ({ signal }) => getProgramReferences({ assignedOnly }, { signal }),
    errorMessage: 'Could not load programs',
  });
}

export function useStaffReferences(feature: StaffReferenceFeature) {
  return useListQuery({
    queryKey: referenceDataKeys.staff(feature),
    queryFn: ({ signal }) => getStaffReferences(feature, { signal }),
    errorMessage: 'Could not load staff',
  });
}

export function useSchoolReferences({ enabled = true }: { enabled?: boolean } = {}) {
  return useListQuery({
    queryKey: referenceDataKeys.schools,
    enabled,
    queryFn: ({ signal }) => getSchoolReferences({ signal }),
    errorMessage: 'Could not load schools',
  });
}
