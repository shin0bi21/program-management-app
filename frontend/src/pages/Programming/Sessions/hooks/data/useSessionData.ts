import { useQuery } from '@tanstack/react-query';
import { getErrorMessage } from '../../../../../http/errors';
import { referenceDataKeys, useCycleReferences } from '../../../../../common/features/referenceData/hooks/useReferenceData';
import { getSessionReferenceData } from '../../sessions.api';

export default function useSessionData() {
  const references = useQuery({
    queryKey: referenceDataKeys.sessionScheduling,
    queryFn: ({ signal }) => getSessionReferenceData({ signal }),
  });
  const cycles = useCycleReferences();

  return {
    programs: references.data?.programs ?? [],
    sessionTypes: references.data?.sessionTypes ?? [],
    referencesLoading: references.isLoading,
    referencesError: references.error ? getErrorMessage(references.error, 'Could not load session options.') : '',
    cycles: cycles.data ?? [],
    cyclesLoading: cycles.isLoading,
    cyclesError: cycles.error ? getErrorMessage(cycles.error, 'Could not load cycles') : '',
  };
}
