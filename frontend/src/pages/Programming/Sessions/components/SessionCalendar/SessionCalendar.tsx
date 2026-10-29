import { useCallback, useEffect, useMemo } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import TimelineCalendar from '../../../../../common/components/TimelineCalendar/TimelineCalendar';
import { useDataBuffer } from '../../../../../common/components/TimelineCalendar/hooks/useDataBuffer/useDataBuffer';
import type { PeriodRange } from '../../../../../common/components/TimelineCalendar/hooks/useDataBuffer/DataBuffer';
import usePageErrorReporter, { type PageErrorChangeHandler } from '../../../../../common/components/PageErrorOverlay/usePageErrorReporter';
import UnavailableState from '../../../../../common/components/UnavailableState/UnavailableState';
import type { Program } from '../../../../../common/features/programs/types';
import type { MoveSessionResult } from '../../sessions.api';
import { getSessions } from '../../sessions.api';
import type { CohortSession, SessionListFilters } from '../../types';
import { getSessionRange } from './sessionCalendarDates';
import { getSessionRequestRange } from '../../utils/sessionDateRange';
import { intersectDateRanges } from '../../../../../common/utils/dateRange';
import SessionItem from './SessionItem/SessionItem';
import './SessionCalendar.css';

const SESSION_CALENDAR_POSITION_KEY = 'resource-calendar:sessions:position';
const getSessionId = (session: CohortSession) => session.id;

interface SessionCalendarProps {
  queryKey: readonly unknown[];
  filters: SessionListFilters;
  programs: Program[];
  selectedProgramId?: string | null;
  selectedSessionId: string;
  onProgramSelect?: (program: Program, source?: 'row' | 'item') => void;
  onSessionsLoaded?: (sessions: CohortSession[]) => void;
  onSessionSelect: (session: CohortSession) => void;
  pendingSessionIds?: string[];
  onSessionMove?: (session: CohortSession, date: string) => Promise<(CohortSession & MoveSessionResult) | null>;
  onAddSession?: (program: Program, date: string) => void;
  onSessionEdit?: (session: CohortSession) => void;
  onSessionDelete?: (session: CohortSession) => void;
  onErrorChange?: PageErrorChangeHandler;
}

export default function SessionCalendar({
  queryKey, filters, programs, selectedProgramId, selectedSessionId, onProgramSelect,
  onSessionsLoaded, onSessionSelect, onSessionMove, pendingSessionIds = [], onAddSession, onSessionEdit, onSessionDelete, onErrorChange,
}: SessionCalendarProps) {
  const queryClient = useQueryClient();
  const loadRange = useCallback(async ({ start, end }: PeriodRange) => {
    const dates = intersectDateRanges({ start: start.key, end: end.key }, filters.dateRange);
    if (!dates) return {};

    const requestRange = getSessionRequestRange(dates.start, dates.end);
    const requestFilters = { ...filters, ...requestRange };
    const sessions = await queryClient.fetchQuery({
      queryKey: [...queryKey, requestFilters],
      queryFn: ({ signal }) => getSessions(requestFilters, { signal }),
    });

    return sessions.reduce<Record<string, Record<string, CohortSession[]>>>((data, session) => {
      data[session.programId] ??= {};
      data[session.programId][start.key] ??= [];
      data[session.programId][start.key].push(session);
      return data;
    }, {});
  }, [filters, queryClient, queryKey]);
  const calendar = useDataBuffer({
    load: loadRange,
    getItemId: getSessionId,
    getItemRange: getSessionRange,
    errorMessage: 'Unable to load sessions calendar data',
  });
  const retryAction = useMemo(() => ({ label: 'Retry', onClick: calendar.retry }), [calendar.retry]);
  usePageErrorReporter(onErrorChange, calendar.error, retryAction);

  const sessions = useMemo(() => Object.values(calendar.items).flatMap(items => items ?? []), [calendar.items]);
  useEffect(() => {
    onSessionsLoaded?.(sessions);
  }, [onSessionsLoaded, sessions]);

  const visiblePrograms = useMemo(() => filters.programIds?.length
    ? programs.filter(program => filters.programIds!.includes(program.id))
    : programs, [filters.programIds, programs]);

  if (calendar.error) return <UnavailableState title="Sessions calendar unavailable" onRetry={calendar.retry} />;

  return <div className="sessions-calendar-view">
    <TimelineCalendar
      dateRange={filters.dateRange}
      rows={visiblePrograms}
      items={calendar.items}
      onInitialPeriods={calendar.initialize}
      onPeriodsBuilt={calendar.onPeriodsBuilt}
      onPeriodsReset={calendar.reset}
      getRowId={program => program.id}
      getItemId={getSessionId}
      getItemRange={getSessionRange}
      getItemCapabilities={({ data: session }) => ({
        draggable: Boolean(onSessionMove) && !session.cancelledAt
          && new Date(session.startsAt).getTime() > Date.now() && !pendingSessionIds.includes(session.id),
        resizable: false,
      })}
      canItemMove={({ row, destinationRow }) => row.id === destinationRow.id}
      onItemMove={onSessionMove ? async ({ item: session, nextRange }) => {
        const updated = await onSessionMove(session, nextRange.start);
        if (!updated) return;

        if (filters.cycleIds?.length && !filters.cycleIds.includes(updated.cycleId)) {
          calendar.removeItem(updated.id);
        } else {
          calendar.upsertItem(updated.programId, getSessionRange(updated).start, updated);
        }
      } : undefined}
      renderRow={({ row }) => <span>{row.name}</span>}
      selectedRowId={selectedProgramId}
      onRowSelect={onProgramSelect}
      onCellActivate={onAddSession ? ({ row, period }) => onAddSession(row, period.key) : undefined}
      buildItem={({ data: session, row, calendar: itemCalendar }) => <SessionItem
        calendar={itemCalendar}
        session={session}
        timezone={row.timezone}
        selected={session.id === selectedSessionId}
        onEdit={onSessionEdit && !pendingSessionIds.includes(session.id) ? () => onSessionEdit(session) : undefined}
        onDelete={onSessionDelete && !pendingSessionIds.includes(session.id) ? () => onSessionDelete(session) : undefined}
      />}
      onItemActivate={({ data: session }) => onSessionSelect(session)}
      ariaLabel="Sessions calendar"
      positionStorageKey={SESSION_CALENDAR_POSITION_KEY}
      rowHeader="Program"
      rowHeight={112}
    />
  </div>;
}
