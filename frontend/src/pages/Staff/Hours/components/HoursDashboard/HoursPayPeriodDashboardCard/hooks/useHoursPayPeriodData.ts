import { useQuery } from '@tanstack/react-query';

import { getHoursPayPeriodData } from '../../../../hours.api';
import { getErrorMessage } from '../../../../../../../http/errors';

/**
 * Queries one staff member's pay-period totals independently of cycle selection.
 * @param queryKey - Page query namespace, with dashboard summaries below its dashboard prefix.
 * @param staffId - Selected staff member; null disables the request.
 * @param date - Date in the requested pay period; null selects the current period.
 * @example useHoursPayPeriodData(['hours'], 'staff-1', null)
 */
export default function useHoursPayPeriodData(
  queryKey: readonly unknown[],
  staffId: string | null,
  date: string | null = null,
) {
  const query = useQuery({
    queryKey: [...queryKey, 'dashboard', 'pay-period', staffId, date],
    queryFn: ({ signal }) => getHoursPayPeriodData(staffId!, date, { signal }),
    enabled: Boolean(staffId),
  });

  if (!staffId) return { status: 'unavailable' } as const;
  if (query.isLoading) return { status: 'loading' } as const;
  if (query.error) return {
    status: 'error',
    message: getErrorMessage(query.error, 'Could not load pay-period hours.'),
    retry: query.refetch,
  } as const;

  return query.data
    ? { status: 'ready', data: query.data } as const
    : { status: 'loading' } as const;
}
