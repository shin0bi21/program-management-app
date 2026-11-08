import { useQuery } from '@tanstack/react-query';
import { getErrorMessage } from '../../../../../../http/errors';
import { getYouthAttendanceSummary } from '../youthAttendanceSummary.api';

/**
 * Loads attendance summaries only for the youth selected in the dashboard.
 * @param youthId - Selected youth ID; null leaves the dashboard without a selection.
 * @returns Summary rows, loading and error states, and an action to retry a failed request.
 * @example useYouthAttendanceSummary(selectedProfileId) // selected youth's attendance counts
 */
export default function useYouthAttendanceSummary(youthId: string | null) {
  const { data, error, isLoading, refetch } = useQuery({
    queryKey: ['youth', 'attendance-summary', youthId],
    queryFn: ({ signal }) => getYouthAttendanceSummary(youthId!, { signal }),
    enabled: Boolean(youthId),
  });

  return {
    programCycles: data ?? [],
    loading: Boolean(youthId) && isLoading,
    error: error ? getErrorMessage(error, 'Could not load attendance.') : null,
    retry: refetch,
  };
}
