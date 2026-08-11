import { useEffect, useRef, useState } from 'react';
import { getTimeEntryOverview, type TimeEntryOverviewResponse } from '../../../../common/features/timeEntries/api/timeEntries.api';
import { getErrorMessage } from '../../../../http/clientErrors';

export type TimesheetOverviewState =
  | { status: 'unavailable' }
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'ready'; data: TimeEntryOverviewResponse };

export function useTimesheetOverview(staffId: string | null, cycleId: string | null, refreshToken: unknown) {
  const [state, setState] = useState<TimesheetOverviewState>({ status: 'unavailable' });
  const requestRevisionRef = useRef(0);

  useEffect(() => {
    const revision = requestRevisionRef.current + 1;
    requestRevisionRef.current = revision;
    if (!staffId || !cycleId) {
      setState({ status: 'unavailable' });
      return undefined;
    }

    const controller = new AbortController();
    setState({ status: 'loading' });
    void getTimeEntryOverview(staffId, cycleId, { signal: controller.signal })
      .then(data => {
        if (controller.signal.aborted || requestRevisionRef.current !== revision) return;
        setState({ status: 'ready', data });
      })
      .catch((cause: unknown) => {
        if (controller.signal.aborted || requestRevisionRef.current !== revision) return;
        setState({ status: 'error', message: getErrorMessage(cause, 'Could not load the timesheet overview.') });
      });

    return () => controller.abort();
  }, [cycleId, refreshToken, staffId]);

  return state;
}
