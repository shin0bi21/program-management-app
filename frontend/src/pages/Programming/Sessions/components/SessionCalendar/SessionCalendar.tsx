import { sessionStore } from '../../sessionStore';
import { useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useMemo, type MutableRefObject } from 'react';
import TimelineCalendar from '../../../../../common/components/TimelineCalendar/TimelineCalendar';
import UnavailableState from '../../../../../common/components/UnavailableState/UnavailableState';
import usePageMessageReporter, { type PageMessageChangeHandler } from '../../../../../common/components/PageMessageOverlay/usePageMessageReporter';
import { useDataBuffer } from '../../../../../common/components/TimelineCalendar/hooks/useDataBuffer/useDataBuffer';
import type { PeriodRange } from '../../../../../common/components/TimelineCalendar/hooks/useDataBuffer/DataBuffer';
import type {
  BuildItemContext,
  CalendarItemReference,
  RowItemData,
  ItemCapabilityContext,
  ItemMoveContext,
  RenderRowContext,
} from '../../../../../common/components/TimelineCalendar/types';
import type { Program } from '../../../../../common/features/programs/types';
import { intersectDateRanges } from '../../../../../common/utils/dateRange';
import { getSessions } from '../../sessions.api';
import type { ProgramSession, SessionCalendarCache, SessionListFilters } from '../../types';
import { getSessionRequestRange } from '../../utils/sessionDateRange';
import { getSessionRange } from './sessionCalendarDates';
import SessionItem from './SessionItem/SessionItem';
import './SessionCalendar.css';

const SESSION_CALENDAR_POSITION_KEY = 'resource-calendar:sessions:position';

interface SessionCalendarProps {
  filters: SessionListFilters;
  programs: Program[];
  selectedProgramId?: string | null;
  selectedSessionId: string;
  calendarCacheRef: MutableRefObject<SessionCalendarCache>;
  pendingSessionIds?: string[];

  onProgramSelect?: (program: Program, source?: 'row' | 'item') => void;
  onSessionSelect: (session: ProgramSession) => void;
  onSessionMove?: (session: ProgramSession, date: string) => Promise<ProgramSession | null>;
  onAddSession?: (program: Program, date: string) => void;
  onSessionEdit?: (session: ProgramSession) => void;
  onSessionDelete?: (session: ProgramSession) => void;
  onMessageChange?: PageMessageChangeHandler;
}

const getProgramId = (program: Program) => program.id;
const getSessionId = (session: { id: string }) => session.id;
const getReferenceRange = (reference: CalendarItemReference) => ({ start: reference.start, end: reference.end });

/**
 * Displays the program name in a calendar resource header.
 * @example renderProgramRow(context) // program display name
 */
function renderProgramRow({ row }: RenderRowContext<Program>) {
  return <span>{row.name}</span>;
}

/**
 * Restricts session moves to their existing program.
 * @example canMoveWithinProgram(context) // false for a different program
 */
function canMoveWithinProgram({ row, destinationRow }: ItemMoveContext<Program, ProgramSession>) {
  return row.id === destinationRow.id;
}

/**
 * Displays shared sessions through a buffer of IDs and inclusive date placement.
 * @example <SessionCalendar filters={filters} {...viewProps} />
 */
export default function SessionCalendar({
  filters,
  programs,
  selectedProgramId,
  selectedSessionId,
  calendarCacheRef,
  pendingSessionIds = [],

  onProgramSelect,
  onSessionSelect,
  onSessionMove,
  onAddSession,
  onSessionEdit,
  onSessionDelete,
  onMessageChange,
}: SessionCalendarProps) {
  const { cycleIds, programIds, dateRange } = filters;
  const client = useQueryClient();
  const records = sessionStore.useRecords();

  const loadRange = useCallback(async ({ start, end }: PeriodRange, signal: AbortSignal) => {
    const dates = intersectDateRanges({ start: start.key, end: end.key }, filters.dateRange);
    if (!dates) return {};

    const requestRange = getSessionRequestRange(dates.start, dates.end);
    const requestFilters = { ...filters, ...requestRange };
    const read = sessionStore.beginRead(client);
    const incoming = await getSessions(requestFilters, { signal });

    const sessions = sessionStore.finishRead(client, read, incoming, signal);
    const data: Record<string, Record<string, CalendarItemReference[]>> = {};
    for (const session of sessions) {
      data[session.programId] ??= {};
      data[session.programId][start.key] ??= [];
      data[session.programId][start.key].push({ id: session.id, ...getSessionRange(session) });
    }

    return data;
  }, [client, filters]);

  const calendar = useDataBuffer({
    load: loadRange,
    getItemId: getSessionId,
    getItemRange: getReferenceRange,
    errorMessage: 'Unable to load sessions calendar data',
  });
  const visibleItems = useMemo<RowItemData<ProgramSession>>(() => {
    const items: Record<string, ProgramSession[]> = {};
    for (const references of Object.values(calendar.items)) {
      for (const { id } of references ?? []) {
        const session = records[id];
        if (session) (items[session.programId] ??= []).push(session);
      }
    }
    return items;
  }, [calendar.items, records]);
  const { upsertItem, removeItem } = calendar;

  const retryAction = useMemo(() => ({ label: 'Retry', onClick: calendar.retry }), [calendar.retry]);
  usePageMessageReporter(onMessageChange, calendar.error, retryAction);

  useEffect(() => {
    calendarCacheRef.current = {
      upsert: session => {
        const outsideSelectedCycles = cycleIds?.length && !cycleIds.includes(session.cycleId);

        if (outsideSelectedCycles) {
          removeItem(session.id);
          return;
        }

        const range = getSessionRange(session);
        upsertItem(session.programId, range.start, { id: session.id, ...range });
      },
      remove: removeItem,
    };

    return () => {
      calendarCacheRef.current = {
        upsert: () => undefined,
        remove: () => undefined,
      };
    };
  }, [calendarCacheRef, cycleIds, removeItem, upsertItem]);

  const visiblePrograms = useMemo(() => {
    if (!programIds?.length) return programs;

    return programs.filter(program => programIds.includes(program.id));
  }, [programIds, programs]);

  /**
   * Displays a shared session with selection and permitted edit/delete actions.
   * @example buildItem(context) // session item for its program row
   */
  function buildItem({ data: session, row, calendar: itemCalendar }: BuildItemContext<Program, ProgramSession>) {
    const isPending = pendingSessionIds.includes(session.id);

    return (
      <SessionItem
        calendar={itemCalendar}
        session={session}
        timezone={row.timezone}
        selected={session.id === selectedSessionId}
        onEdit={onSessionEdit && !isPending ? () => onSessionEdit(session) : undefined}
        onDelete={onSessionDelete && !isPending ? () => onSessionDelete(session) : undefined}
      />
    );
  }

  /**
   * Allows dragging upcoming, active sessions when no mutation is pending.
   * @example getItemCapabilities(context) // draggable flag and resizing disabled
   */
  function getItemCapabilities({ data: session }: ItemCapabilityContext<Program, ProgramSession>) {
    const draggable = Boolean(onSessionMove)
      && !session.cancelledAt
      && new Date(session.startsAt).getTime() > Date.now()
      && !pendingSessionIds.includes(session.id);

    return { draggable, resizable: false };
  }

  /**
   * Reports the requested date to the session mutation owner.
   * @example moveSession(context) // saves the new start day
   */
  async function moveSession({ item: session, nextRange }: ItemMoveContext<Program, ProgramSession>) {
    await onSessionMove?.(session, nextRange.start);
  }

  if (calendar.error) {
    return <UnavailableState title="Sessions calendar unavailable" onRetry={calendar.retry} />;
  }

  return (
    <div className="sessions-calendar-view">
      <TimelineCalendar
        ariaLabel="Sessions calendar"
        dateRange={dateRange}
        positionStorageKey={SESSION_CALENDAR_POSITION_KEY}
        onPeriodsBuilt={calendar.onPeriodsBuilt}
        onInitialPeriods={calendar.initialize}
        onPeriodsReset={calendar.reset}

        rows={visiblePrograms}
        rowHeader="Program"
        getRowId={getProgramId}
        renderRow={renderProgramRow}
        selectedRowId={selectedProgramId}
        onRowSelect={onProgramSelect}

        items={visibleItems}
        getItemId={getSessionId}
        getItemRange={getSessionRange}
        buildItem={buildItem}

        getItemCapabilities={getItemCapabilities}
        onItemActivate={({ data: session }) => onSessionSelect(session)}
        onItemMove={onSessionMove ? moveSession : undefined}
        canItemMove={canMoveWithinProgram}

        onCellActivate={onAddSession ? ({ row, period }) => onAddSession(row, period.key) : undefined}
      />
    </div>
  );
}
