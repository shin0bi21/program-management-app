import { useQuery } from '@tanstack/react-query';

import { getHoursCycleSummaryData } from '../../../../hours.api';
import { getErrorMessage } from '../../../../../../../http/errors';

/**
 * Queries one staff member's biweekly summary independently of pay-period selection.
 * @param queryKey - Page query namespace, with dashboard summaries below its dashboard prefix.
 * @param staffId - Selected staff member; null disables the request.
 * @param cycleId - Selected cycle; null disables the request.
 * @example useHoursCycleSummaryData(['hours'], 'staff-1', 'cycle-1')
 */
export default function useHoursCycleSummaryData(
  queryKey: readonly unknown[],
  staffId: string | null,
  cycleId: string | null,
) {
  const query = useQuery({
    queryKey: [...queryKey, 'dashboard', 'cycle-summary', staffId, cycleId],
    queryFn: ({ signal }) => getHoursCycleSummaryData(staffId!, cycleId!, { signal }),
    enabled: Boolean(staffId && cycleId),
  });

  if (!staffId || !cycleId) return { status: 'unavailable' } as const;
  if (query.isLoading) return { status: 'loading' } as const;
  if (query.error) return {
    status: 'error',
    message: getErrorMessage(query.error, 'Could not load cycle hours.'),
    retry: query.refetch,
  } as const;

  return query.data
    ? { status: 'ready', data: query.data } as const
    : { status: 'loading' } as const;
}
