import { useProgramReferences } from '../../../../common/features/referenceData/hooks/useReferenceData';

export default function useLeadData() {
  const programs = useProgramReferences();

  return {
    programs: programs.rows,
    programsLoading: programs.loading,
    programsError: programs.error,
  };
}
