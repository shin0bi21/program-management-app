import { useQuery, type UseQueryResult } from '@tanstack/react-query';

import { getHoursCycleSummaryData, type HoursCycleSummaryData } from '../../../../api/hours.api';
import type { Hours } from '../../../../types';

/**
 * Queries one staff member's biweekly summary independently of pay-period selection.
 * @param queryKey - Page query namespace, with dashboard summaries below its dashboard prefix.
 * @param staffId - Selected staff member; null disables the request.
 * @param cycleId - Selected cycle; null disables the request.
 * @example useHoursCycleSummaryData(['hours'], 'staff-1', 'cycle-1')
 */
export default function useHoursCycleSummaryData(
  queryKey: readonly unknown[],
  staffId: Hours['staffId'] | null,
  cycleId: Hours['cycleId'] | null,
): UseQueryResult<HoursCycleSummaryData> {
  return useQuery({
    queryKey: [...queryKey, 'dashboard', 'cycle-summary', staffId, cycleId],
    queryFn: ({ signal }) => getHoursCycleSummaryData(staffId!, cycleId!, { signal }),
    enabled: Boolean(staffId && cycleId),
  });
}
