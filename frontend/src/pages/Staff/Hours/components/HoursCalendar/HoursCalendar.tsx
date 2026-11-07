import { useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useMemo, type MutableRefObject } from 'react';
import TimelineCalendar from '../../../../../common/components/TimelineCalendar/TimelineCalendar';
import UnavailableState from '../../../../../common/components/UnavailableState/UnavailableState';
import usePageMessageReporter, { type PageMessageChangeHandler } from '../../../../../common/components/PageMessageOverlay/usePageMessageReporter';
import { useDataBuffer } from '../../../../../common/components/TimelineCalendar/hooks/useDataBuffer/useDataBuffer';
import type { PeriodRange } from '../../../../../common/components/TimelineCalendar/hooks/useDataBuffer/DataBuffer';
import type {
  BuildItemContext,
  CalendarCellContext,
  ItemCapabilityContext,
  ItemMoveContext,
  RenderRowContext,
  RowItemData,
} from '../../../../../common/components/TimelineCalendar/types';
import { formatCompactPersonName } from '../../../../../common/utils/name';
import { getHoursCalendarData } from '../../hours.api';
import { beginHoursRead, finishHoursRead, useHoursItems, type HoursItemRef } from '../../hoursItemStore';
import type {
  StaffResource,
  HoursFilters,
  HoursCalendarIndex,
  HoursItemMove,
  HoursItem,
} from '../../types';
import HoursCalendarItem from './HoursItem/HoursItem';

const initialDate = new Date();
const HOURS_CALENDAR_POSITION_KEY = 'resource-calendar:hours:position';

interface HoursCalendarProps {
  resources: StaffResource[];
  filters: HoursFilters;
  canWrite: boolean;
  selectedStaffId?: string;
  calendarIndexRef: MutableRefObject<HoursCalendarIndex>;
  isItemPending: (itemId: string) => boolean;

  onStaffSelect: (staffId: string) => void;
  onEdit: (target: HoursItem) => void;
  onDelete: (target: HoursItem) => void;
  onAdd: (target: { staffId: string; date: string; source: 'regular' | 'task' | 'session' }) => void;
  onMove: (move: HoursItemMove) => Promise<void>;
  onMessageChange?: PageMessageChangeHandler;
}

const getStaffResourceId = (resource: StaffResource) => resource.id;
const getHoursItemId = (item: HoursItemRef) => item.id;
const getHoursItemRange = (data: HoursItem) => ({ start: data.date, end: data.date });

/**
 * Displays the staff member for a calendar row.
 * @example renderStaffRow(context) // compact staff name
 */
function renderStaffRow({ row }: RenderRowContext<StaffResource>) {
  return (
    <div className="hours-resource">
      <span aria-label={row.name}>{formatCompactPersonName(row.firstName, row.lastName)}</span>
    </div>
  );
}

/**
 * Allows a move only within the same writable staff row.
 * @example canMoveWithinStaff(context) // false when destination staff differs
 */
function canMoveWithinStaff({ row, destinationRow }: ItemMoveContext<StaffResource, HoursItem>) {
  return row.writable && destinationRow.writable && row.id === destinationRow.id;
}

/**
 * Displays shared Hours records through a range buffer of entry IDs.
 * @example <HoursCalendar filters={filters} {...viewProps} />
 */
export default function HoursCalendar({
  resources,
  filters,
  canWrite,
  selectedStaffId,
  calendarIndexRef,
  isItemPending,

  onStaffSelect,
  onEdit,
  onDelete,
  onAdd,
  onMove,
  onMessageChange,
}: HoursCalendarProps) {
  const { staffIds, cycleIds, dateRange } = filters;
  const client = useQueryClient();
  const records = useHoursItems();

  const loadRange = useCallback(async ({ start, end }: PeriodRange, signal: AbortSignal) => {
    const read = beginHoursRead(client);
    const incoming = await getHoursCalendarData(filters, { start: start.key, end: end.key }, { signal });
    const rows = finishHoursRead(client, read, incoming, signal);
    const index: Record<string, Record<string, HoursItemRef[]>> = {};

    for (const entry of rows) {
      const periods = index[entry.staffId] ??= {};
      const items = periods[entry.date] ??= [];
      items.push({ id: entry.id });
    }
    return index;
  }, [client, filters]);

  const calendar = useDataBuffer({
    load: loadRange,
    getItemId: getHoursItemId,
    errorMessage: 'Unable to load hours data',
  });
  const visibleItems = useMemo<RowItemData<HoursItem>>(() => {
    const items: Record<string, HoursItem[]> = {};
    for (const references of Object.values(calendar.items)) {
      for (const { id } of references ?? []) {
        const entry = records[id];
        if (entry) (items[entry.staffId] ??= []).push(entry);
      }
    }
    return items;
  }, [calendar.items, records]);

  const { upsertItem, removeItem } = calendar;

  const retryAction = useMemo(() => ({ label: 'Retry', onClick: calendar.retry }), [calendar.retry]);
  usePageMessageReporter(onMessageChange, calendar.error, retryAction);

  useEffect(() => {
    calendarIndexRef.current = {
      upsert: (entry) => {
        const outsideSelectedCycles = cycleIds?.length && !cycleIds.includes(entry.cycleId);

        // A move can resolve to an unselected cycle inside the displayed date span.
        if (outsideSelectedCycles) {
          removeItem(entry.id);
          return;
        }

        upsertItem(entry.staffId, entry.date, { id: entry.id });
      },
      remove: removeItem,
    };

    return () => {
      calendarIndexRef.current = {
        upsert: () => undefined,
        remove: () => undefined,
      };
    };
  }, [calendarIndexRef, cycleIds, removeItem, upsertItem]);

  const visibleResources = useMemo(() => {
    if (!staffIds.length) return resources;

    return resources.filter(resource => staffIds.includes(resource.id));
  }, [staffIds, resources]);

  const buildItem = useCallback(({
    row,
    data,
    calendar: itemCalendar,
  }: BuildItemContext<StaffResource, HoursItem>) => {
    const entry = data;
    const canModifyEntry = canWrite && row.writable && !isItemPending(entry.id);

    return (
      <HoursCalendarItem
        calendar={itemCalendar}
        item={entry}
        onEdit={canModifyEntry ? () => onEdit(entry) : undefined}
        onDelete={canModifyEntry ? () => onDelete(entry) : undefined}
      />
    );
  }, [canWrite, isItemPending, onDelete, onEdit]);

  function getItemCapabilities({ row, data }: ItemCapabilityContext<StaffResource, HoursItem>) {
    const entry = data;
    const draggable = canWrite && row.writable && !entry.sessionId && !isItemPending(entry.id);

    return { draggable };
  }

  function moveHours({ item, nextRange }: ItemMoveContext<StaffResource, HoursItem>) {
    return onMove({ item, date: nextRange.start });
  }

  function getCellActions({ row, period }: CalendarCellContext<StaffResource, HoursItem>) {
    if (!row.writable) return [];

    const target = { staffId: row.id, date: period.key };

    return [
      { id: 'session', label: 'Session Hours', onSelect: () => onAdd({ ...target, source: 'session' }) },
      { id: 'task', label: 'Task Hours', onSelect: () => onAdd({ ...target, source: 'task' }) },
      { id: 'regular', label: 'Regular Hours', onSelect: () => onAdd({ ...target, source: 'regular' }) },
    ];
  }

  if (calendar.error) {
    return <UnavailableState title="Hours calendar unavailable" onRetry={calendar.retry} />;
  }

  return (
    <TimelineCalendar<StaffResource, HoursItem>
      ariaLabel="Staff hours calendar"
      initialDate={initialDate}
      dateRange={dateRange}
      positionStorageKey={HOURS_CALENDAR_POSITION_KEY}
      onPeriodsBuilt={calendar.onPeriodsBuilt}
      onInitialPeriods={calendar.initialize}
      onPeriodsReset={calendar.reset}

      rows={visibleResources}
      rowHeader="Name"
      getRowId={getStaffResourceId}
      renderRow={renderStaffRow}
      selectedRowId={selectedStaffId}
      onRowSelect={row => onStaffSelect(row.id)}

      items={visibleItems}
      getItemId={getHoursItemId}
      getItemRange={getHoursItemRange}
      buildItem={buildItem}

      getItemCapabilities={getItemCapabilities}
      onItemMove={canWrite ? moveHours : undefined}
      canItemMove={canMoveWithinStaff}

      getCellActions={canWrite ? getCellActions : undefined}
    />
  );
}
