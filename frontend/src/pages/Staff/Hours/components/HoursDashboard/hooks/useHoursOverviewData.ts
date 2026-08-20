import { useQuery } from '@tanstack/react-query';

import {
  getTimeEntryOverview,
  type TimeEntryOverviewResponse,
} from '../../../../../../common/features/timeEntries/timeEntries.api';
import { getErrorMessage } from '../../../../../../http/clientErrors';

export type HoursOverviewState =
  | { status: 'unavailable' }
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'ready'; data: TimeEntryOverviewResponse };

export default function useHoursOverviewData(
  queryKey: readonly unknown[],
  staffId: string | null,
  cycleId: string | null,
): HoursOverviewState {
  const { data, error, isLoading } = useQuery({
    queryKey: [...queryKey, 'overview', staffId, cycleId],
    queryFn: ({ signal }) => getTimeEntryOverview(staffId!, cycleId!, { signal }),
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
