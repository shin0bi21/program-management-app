import { useProgramReferences } from '../../../../common/features/referenceData/hooks/useReferenceData';

/**
 * Supplies shared program references for lead filters and forms.
 * @example const { programs } = useLeadData()
 */
export default function useLeadData() {
  const programs = useProgramReferences();

  return {
    programs: programs.rows,
    programsLoading: programs.loading,
    programsError: programs.error,
  };
}
