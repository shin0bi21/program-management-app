import { useQuery, type UseQueryResult } from '@tanstack/react-query';

import { getHoursPayPeriodData, type HoursPayPeriodData } from '../../../../api/hours.api';
import type { Hours } from '../../../../types';

/**
 * Queries one staff member's pay-period totals independently of cycle selection.
 * @param queryKey - Page query namespace, with dashboard summaries below its dashboard prefix.
 * @param staffId - Selected staff member; null disables the request.
 * @param date - Date in the requested pay period; null selects the current period.
 * @example useHoursPayPeriodData(['hours'], 'staff-1', null)
 */
export default function useHoursPayPeriodData(
  queryKey: readonly unknown[],
  staffId: Hours['staffId'] | null,
  date: Hours['date'] | null = null,
): UseQueryResult<HoursPayPeriodData> {
  return useQuery({
    queryKey: [...queryKey, 'dashboard', 'pay-period', staffId, date],
    queryFn: ({ signal }) => getHoursPayPeriodData(staffId!, date, { signal }),
    enabled: Boolean(staffId),
  });
}
