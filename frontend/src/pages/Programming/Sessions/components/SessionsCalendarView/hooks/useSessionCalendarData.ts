import { useCallback, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import type { DatesSetInfo, EventInput } from '@fullcalendar/react';
import { getSessions } from '../../../../../../common/features/programming/api/sessions.api';
import type { CohortSession } from '../../../../../../common/types/cohort';
import type { SessionStatusFilter } from '../../../types';

interface SessionCalendarFilters {
  programIds: string[];
  cohortId: string;
  sessionTypeIds: string[];
  statuses: SessionStatusFilter[];
  search: string;
}

const noSessions: CohortSession[] = [];

export function useSessionCalendarData(
  queryKey: readonly unknown[],
  filters: SessionCalendarFilters,
  selectedSessionId: string,
) {
  const [range, setRange] = useState<{ start: string; end: string } | null>(null);
  const requestFilters = range ? {
    start: range.start,
    end: range.end,
    programIds: filters.programIds,
    cohortId: filters.cohortId || undefined,
    ...(filters.sessionTypeIds.length && { sessionTypeIds: filters.sessionTypeIds }),
    statuses: filters.statuses,
    search: filters.search || undefined,
  } : null;
  const query = useQuery({
    queryKey: [...queryKey, requestFilters],
    queryFn: ({ signal }) => getSessions(requestFilters!, { signal }),
    enabled: requestFilters !== null,
  });
  const sessions = query.data ?? noSessions;
  const events = useMemo<EventInput[]>(() => sessions.map(session => ({
    id: session.id,
    title: session.theme,
    start: session.startsAt,
    end: session.endsAt,
    backgroundColor: session.cancelledAt ? '#6b7280' : undefined,
    borderColor: session.cancelledAt ? '#6b7280' : undefined,
    classNames: session.id === selectedSessionId ? ['programming-calendar-event--selected'] : [],
    extendedProps: { programName: session.programName, sessionTypeName: session.sessionTypeName },
  })), [selectedSessionId, sessions]);
  const onDatesSet = useCallback((nextRange: DatesSetInfo) => setRange({
    start: nextRange.start.toISOString(),
    end: nextRange.end.toISOString(),
  }), []);

  return { sessions, events, error: query.error, isError: query.isError, isSuccess: query.isSuccess, onDatesSet };
}
