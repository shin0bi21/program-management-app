import { useQuery } from '@tanstack/react-query';

import {
  getHoursDashboardData,
  type HoursDashboardData,
} from '../../../hours.api';
import { getErrorMessage } from '../../../../../../http/errors';

export type HoursOverviewState =
  | { status: 'unavailable' }
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'ready'; data: HoursDashboardData };

export default function useHoursOverviewData(
  queryKey: readonly unknown[],
  staffId: string | null,
  cycleId: string | null,
): HoursOverviewState {
  const { data, error, isLoading } = useQuery({
    queryKey: [...queryKey, 'dashboard', staffId, cycleId],
    queryFn: ({ signal }) => getHoursDashboardData(staffId!, cycleId!, { signal }),
    enabled: Boolean(staffId && cycleId),
  });

  if (!staffId || !cycleId) return { status: 'unavailable' };
  if (isLoading) return { status: 'loading' };
  if (error) return {
    status: 'error',
    message: getErrorMessage(error, 'Could not load the hours overview.'),
  };
  return data ? { status: 'ready', data } : { status: 'loading' };
}
