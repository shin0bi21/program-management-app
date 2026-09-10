import { useCallback, useEffect, useMemo } from 'react';
import TimelineCalendar from '../../../../../common/components/TimelineCalendar/TimelineCalendar';
import usePageErrorReporter, { type PageErrorChangeHandler } from '../../../../../common/components/PageErrorOverlay/usePageErrorReporter';
import { useDataBuffer } from '../../../../../common/components/TimelineCalendar/hooks/useDataBuffer/useDataBuffer';
import type { PeriodRange } from '../../../../../common/components/TimelineCalendar/hooks/useDataBuffer/DataBuffer';
import type {
  BuildItemContext,
  CalendarCellContext,
  ItemMoveContext,
  RowItemData,
} from '../../../../../common/components/TimelineCalendar/types';
import { getHoursCalendarData } from '../../hours.api';
import type { StaffResource, HoursFilters, HoursItem as HoursEntry } from '../../types';
import { formatCompactPersonName } from '../../../../../common/utils/name';
import type {
  HoursCalendarCache,
  HoursEntryMove,
  HoursEntryTarget,
} from '../../types';
import HoursItem from './HoursItem/HoursItem';
import UnavailableState from '../../../../../common/components/UnavailableState/UnavailableState';

const initialDate = new Date();
const HOURS_CALENDAR_POSITION_KEY = 'resource-calendar:hours:position';
const getStaffResourceId = (resource: StaffResource) => resource.id;
export interface HoursCalendarItem { date: string; item: HoursEntry }
const getHoursEntryId = (item: HoursEntry) => item.id;
const getHoursCalendarItemId = (item: HoursCalendarItem) => item.item.id;
const canMoveWithinStaff = ({ row, destinationRow }: ItemMoveContext<StaffResource, HoursCalendarItem>) => row.writable
  && destinationRow.writable
  && row.id === destinationRow.id;
interface HoursCalendarProps {
  resources: StaffResource[];
  filters: HoursFilters;
  canWrite: boolean;
  selectedStaffId?: string;
  calendarCacheRef: React.MutableRefObject<HoursCalendarCache>;
  isEntryPending: (entryId: string) => boolean;
  onStaffSelect: (staffId: string) => void;
  onEdit: (target: HoursEntryTarget) => void;
  onDelete: (target: HoursEntryTarget) => void;
  onAdd: (target: { resourceId: string; date: string; source: 'regular' | 'task' | 'session' }) => void;
  onMove: (move: HoursEntryMove) => Promise<void>;
  onErrorChange?: PageErrorChangeHandler;
}

export default function HoursCalendar({
  resources, filters, canWrite, selectedStaffId,
  calendarCacheRef, isEntryPending, onStaffSelect, onEdit, onDelete, onAdd, onMove, onErrorChange,
}: HoursCalendarProps) {
  const loadRange = useCallback(async ({ start, end }: PeriodRange) => (
    getHoursCalendarData(filters, { start: start.key, end: end.key })
  ), [filters]);
  const calendar = useDataBuffer({
    load: loadRange,
    getItemId: getHoursEntryId,
    errorMessage: 'Unable to load hours data',
  });
  const retryAction = useMemo(() => ({ label: 'Retry', onClick: calendar.retry }), [calendar.retry]);
  usePageErrorReporter(onErrorChange, calendar.error, retryAction);
  useEffect(() => {
    calendarCacheRef.current = { upsert: calendar.upsertItem, remove: calendar.removeItem };
    return () => { calendarCacheRef.current = { upsert: () => undefined, remove: () => undefined }; };
  }, [calendar.removeItem, calendar.upsertItem, calendarCacheRef]);
  const visibleResources = useMemo(() => filters.staffIds.length
    ? resources.filter(resource => filters.staffIds.includes(resource.id))
    : resources, [filters.staffIds, resources]);
  const visibleItems = useMemo<RowItemData<HoursCalendarItem>>(() => Object.fromEntries(
    Object.entries(calendar.data).map(([resourceId, periods]) => [
      resourceId,
      Object.entries(periods).flatMap(([date, items]) => items.map(item => ({ date, item }))),
    ]),
  ), [calendar.data]);

  const moveHours = ({ item, row, destinationRow, originalRange, nextRange }: ItemMoveContext<StaffResource, HoursCalendarItem>) => onMove({
    item: item.item,
    source: { resourceId: row.id, date: originalRange.start },
    destination: { resourceId: destinationRow.id, date: nextRange.start },
  });
  const renderHoursItem = useCallback((resource: StaffResource, date: string, item: HoursEntry) => (
    <HoursItem
      item={item}
      onEdit={canWrite && resource.writable && !isEntryPending(item.id) ? () => onEdit({ resourceId: resource.id, date, item }) : undefined}
      onDelete={canWrite && resource.writable && !isEntryPending(item.id) ? () => onDelete({ resourceId: resource.id, date, item }) : undefined}
    />
  ), [canWrite, isEntryPending, onDelete, onEdit]);
  const buildItem = useCallback(({ row, range, data }: BuildItemContext<StaffResource, HoursCalendarItem>) => (
    renderHoursItem(row, range.start, data.item)
  ), [renderHoursItem]);
  const openCellEntry = useCallback((
    { row, period }: CalendarCellContext<StaffResource, HoursCalendarItem>,
    source: 'regular' | 'task' | 'session',
  ) => onAdd({ resourceId: row.id, date: period.key, source }), [onAdd]);

  if (calendar.error) return <UnavailableState title="Hours calendar unavailable" onRetry={calendar.retry} />;

  return <>
    <TimelineCalendar<StaffResource, HoursCalendarItem>
      rows={visibleResources}
      items={visibleItems}
      getItemRange={data => ({ start: data.date, end: data.date })}
      initialDate={initialDate}
      positionStorageKey={HOURS_CALENDAR_POSITION_KEY}
      ariaLabel="Staff hours calendar"
      rowHeader="Name"
      onPeriodsBuilt={calendar.onPeriodsBuilt}
      onInitialPeriods={calendar.initialize}
      onPeriodsReset={calendar.reset}
      onItemMove={canWrite ? moveHours : undefined}
      canItemMove={canMoveWithinStaff}
      getItemCapabilities={({ row, data }) => ({
        draggable: canWrite && row.writable && !data.item.sessionId && !isEntryPending(data.item.id),
      })}
      rowHeight={112}
      getCellActions={canWrite ? context => context.row.writable ? [
        { id: 'session', label: 'Session Hours', onSelect: () => openCellEntry(context, 'session') },
        { id: 'task', label: 'Task Hours', onSelect: () => openCellEntry(context, 'task') },
        { id: 'regular', label: 'Regular Hours', onSelect: () => openCellEntry(context, 'regular') },
      ] : [] : undefined}
      getRowId={getStaffResourceId}
      getItemId={getHoursCalendarItemId}
      renderRow={({ row }) => <div className="hours-resource">
        <span aria-label={row.name}>{formatCompactPersonName(row.firstName, row.lastName)}</span>
      </div>}
      selectedRowId={selectedStaffId}
      onRowSelect={row => onStaffSelect(row.id)}
      buildItem={buildItem}
    />
  </>;
}
