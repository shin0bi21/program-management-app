import { useCycleReferences, useProgramReferences } from '../../../../../common/features/referenceData/hooks/useReferenceData';

export default function useCohortData() {
  const programs = useProgramReferences({ assignedOnly: true });
  const cycles = useCycleReferences();

  return {
    programs: programs.rows,
    programsLoading: programs.loading,
    programsError: programs.error,
    cycles: cycles.rows,
    cyclesError: cycles.error,
  };
}
