import { useCycleReferences, useProgramReferences } from '../../../../common/features/referenceData/hooks/useReferenceData';

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
