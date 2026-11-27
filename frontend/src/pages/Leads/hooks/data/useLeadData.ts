import { useProgramReferences } from '../../../../common/features/referenceData/hooks/useReferenceData';
import { getErrorMessage } from '../../../../http/errors';

/**
 * Supplies shared program references for lead filters and forms.
 * @example const { programs } = useLeadData()
 */
export default function useLeadData() {
  const programs = useProgramReferences();

  return {
    programs: programs.data ?? [],
    programsLoading: programs.isLoading,
    programsError: programs.error ? getErrorMessage(programs.error, 'Could not load programs') : '',
  };
}
