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
import type {
  StaffResource,
  HoursFilters,
  HoursItem as HoursEntry,
  HoursCalendarCache,
  HoursEntryMove,
  HoursEntryTarget,
} from '../../types';
import HoursItem from './HoursItem/HoursItem';

const initialDate = new Date();
const HOURS_CALENDAR_POSITION_KEY = 'resource-calendar:hours:position';

export interface HoursCalendarItem {
  date: string;
  item: HoursEntry;
}

interface HoursCalendarProps {
  resources: StaffResource[];
  filters: HoursFilters;
  canWrite: boolean;
  selectedStaffId?: string;
  calendarCacheRef: MutableRefObject<HoursCalendarCache>;
  isEntryPending: (entryId: string) => boolean;

  onStaffSelect: (staffId: string) => void;
  onEdit: (target: HoursEntryTarget) => void;
  onDelete: (target: HoursEntryTarget) => void;
  onAdd: (target: { resourceId: string; date: string; source: 'regular' | 'task' | 'session' }) => void;
  onMove: (move: HoursEntryMove) => Promise<void>;
  onMessageChange?: PageMessageChangeHandler;
}

const getStaffResourceId = (resource: StaffResource) => resource.id;
const getHoursEntryId = (item: HoursEntry) => item.id;
const getHoursCalendarItemId = (data: HoursCalendarItem) => data.item.id;
const getHoursCalendarItemRange = (data: HoursCalendarItem) => ({ start: data.date, end: data.date });

function renderStaffRow({ row }: RenderRowContext<StaffResource>) {
  return (
    <div className="hours-resource">
      <span aria-label={row.name}>{formatCompactPersonName(row.firstName, row.lastName)}</span>
    </div>
  );
}

function canMoveWithinStaff({ row, destinationRow }: ItemMoveContext<StaffResource, HoursCalendarItem>) {
  return row.writable && destinationRow.writable && row.id === destinationRow.id;
}

export default function HoursCalendar({
  resources,
  filters,
  canWrite,
  selectedStaffId,
  calendarCacheRef,
  isEntryPending,

  onStaffSelect,
  onEdit,
  onDelete,
  onAdd,
  onMove,
  onMessageChange,
}: HoursCalendarProps) {
  const { staffIds, cycleIds, dateRange } = filters;

  const loadRange = useCallback(({ start, end }: PeriodRange, signal: AbortSignal) => {
    return getHoursCalendarData(filters, { start: start.key, end: end.key }, { signal });
  }, [filters]);

  const calendar = useDataBuffer({
    load: loadRange,
    getItemId: getHoursEntryId,
    errorMessage: 'Unable to load hours data',
  });
  const { upsertItem, removeItem } = calendar;

  const retryAction = useMemo(() => ({ label: 'Retry', onClick: calendar.retry }), [calendar.retry]);
  usePageMessageReporter(onMessageChange, calendar.error, retryAction);

  useEffect(() => {
    calendarCacheRef.current = {
      upsert: (resourceId, date, item) => {
        const outsideSelectedCycles = cycleIds?.length && !cycleIds.includes(item.cycleId);

        // A move can resolve to an unselected cycle inside the displayed date span.
        if (outsideSelectedCycles) {
          removeItem(item.id);
          return;
        }

        upsertItem(resourceId, date, item);
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

  const visibleResources = useMemo(() => {
    if (!staffIds.length) return resources;

    return resources.filter(resource => staffIds.includes(resource.id));
  }, [staffIds, resources]);

  const visibleItems = useMemo(() => {
    const itemsByResource: RowItemData<HoursCalendarItem> = {};

    for (const [resourceId, periods] of Object.entries(calendar.data)) {
      const resourceItems: HoursCalendarItem[] = [];

      for (const [date, items] of Object.entries(periods)) {
        for (const item of items) {
          resourceItems.push({ date, item });
        }
      }

      itemsByResource[resourceId] = resourceItems;
    }

    return itemsByResource;
  }, [calendar.data]);

  const buildItem = useCallback(({
    row,
    range,
    data,
    calendar: itemCalendar,
  }: BuildItemContext<StaffResource, HoursCalendarItem>) => {
    const entry = data.item;
    const canModifyEntry = canWrite && row.writable && !isEntryPending(entry.id);
    const target: HoursEntryTarget = { resourceId: row.id, date: range.start, item: entry };

    return (
      <HoursItem
        calendar={itemCalendar}
        item={entry}
        onEdit={canModifyEntry ? () => onEdit(target) : undefined}
        onDelete={canModifyEntry ? () => onDelete(target) : undefined}
      />
    );
  }, [canWrite, isEntryPending, onDelete, onEdit]);

  function getItemCapabilities({ row, data }: ItemCapabilityContext<StaffResource, HoursCalendarItem>) {
    const entry = data.item;
    const draggable = canWrite && row.writable && !entry.sessionId && !isEntryPending(entry.id);

    return { draggable };
  }

  function moveHours({
    item,
    row,
    destinationRow,
    originalRange,
    nextRange,
  }: ItemMoveContext<StaffResource, HoursCalendarItem>) {
    return onMove({
      item: item.item,
      source: { resourceId: row.id, date: originalRange.start },
      destination: { resourceId: destinationRow.id, date: nextRange.start },
    });
  }

  function getCellActions({ row, period }: CalendarCellContext<StaffResource, HoursCalendarItem>) {
    if (!row.writable) return [];

    const target = { resourceId: row.id, date: period.key };

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
    <TimelineCalendar<StaffResource, HoursCalendarItem>
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
      getItemId={getHoursCalendarItemId}
      getItemRange={getHoursCalendarItemRange}
      buildItem={buildItem}

      getItemCapabilities={getItemCapabilities}
      onItemMove={canWrite ? moveHours : undefined}
      canItemMove={canMoveWithinStaff}

      getCellActions={canWrite ? getCellActions : undefined}
    />
  );
}
