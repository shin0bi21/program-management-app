import { useCallback, useEffect, useMemo } from 'react';
import Button from '../../../../../common/components/Button/Button';
import ResourceCalendar from '../../../../../common/components/ResourceCalendar/ResourceCalendar';
import { usePeriodDataBuffer } from '../../../../../common/components/ResourceCalendar/data/usePeriodDataBuffer';
import type { PeriodRange } from '../../../../../common/components/ResourceCalendar/data/PeriodDataBuffer';
import type { BuildItemContext, CalendarCellContext, ItemDropContext } from '../../../../../common/components/ResourceCalendar/types';
import { getTimeEntries } from '../../../../../common/features/timeEntries/timeEntries.api';
import type { StaffResource, TimeEntryCategory, TimesheetItem } from '../../../../../common/features/timeEntries/types';
import { formatCompactPersonName } from '../../../../../common/utils/name';
import type {
  TimesheetCalendarCache,
  TimesheetEntryMove,
  TimesheetEntryTarget,
  TimesheetEntryType,
} from '../../types';
import { useTimesheetCalendarData } from './hooks/useTimesheetCalendarData';
import TimeItem from './TimeItem/TimeItem';

const initialDate = new Date();
const TIMESHEET_CALENDAR_POSITION_KEY = 'resource-calendar:timesheets:position';
const getStaffResourceId = (resource: StaffResource) => resource.id;
const getTimesheetItemId = (item: TimesheetItem) => item.id;
const canDropWithinStaff = ({ source, destination }: ItemDropContext<StaffResource, TimesheetItem>) => source.resource.writable
  && destination.resource.writable
  && source.resource.id === destination.resource.id;
const summarizeOverflow = ({ items, itemCount }: { items: readonly TimesheetItem[]; itemCount: number }) => (
  `${itemCount} ${itemCount === 1 ? 'Entry' : 'Entries'} - ${items.reduce((total, item) => total + item.hours, 0)} Hours`
);

interface TimesheetCalendarViewProps {
  resources: StaffResource[];
  staffIds: string[];
  categories: TimeEntryCategory[];
  programIds: string[];
  types: TimesheetEntryType[];
  cycleId: string;
  canWrite: boolean;
  moveError: string | null;
  selectedStaffId?: string;
  mutationCacheRef: React.MutableRefObject<TimesheetCalendarCache>;
  isEntryPending: (entryId: string) => boolean;
  onStaffSelect: (staffId: string) => void;
  onEdit: (target: TimesheetEntryTarget) => void;
  onDelete: (target: TimesheetEntryTarget) => void;
  onAdd: (target: { resourceId: string; date: string; source: 'regular' | 'task' | 'session' }) => void;
  onMove: (move: TimesheetEntryMove) => Promise<void>;
}

export default function TimesheetCalendarView({
  resources, staffIds, categories, programIds, types, cycleId, canWrite, moveError, selectedStaffId,
  mutationCacheRef, isEntryPending, onStaffSelect, onEdit, onDelete, onAdd, onMove,
}: TimesheetCalendarViewProps) {
  const loadRange = useCallback(async ({ start, end }: PeriodRange) => (
    (await getTimeEntries({ start: start.key, end: end.key })).data
  ), []);
  const calendar = usePeriodDataBuffer({
    load: loadRange,
    getItemId: getTimesheetItemId,
    errorMessage: 'Unable to load timesheet data',
  });
  useEffect(() => {
    mutationCacheRef.current = { upsert: calendar.upsertItem, remove: calendar.removeItem };
    return () => { mutationCacheRef.current = { upsert: () => undefined, remove: () => undefined }; };
  }, [calendar.removeItem, calendar.upsertItem, mutationCacheRef]);
  const visibleResources = useMemo(() => staffIds.length
    ? resources.filter(resource => staffIds.includes(resource.id))
    : resources, [resources, staffIds]);
  const visibleData = useTimesheetCalendarData(calendar.data, categories, programIds, types, cycleId);

  const moveTimeEntry = ({ item, source, destination }: ItemDropContext<StaffResource, TimesheetItem>) => onMove({
    item,
    source: { resourceId: source.resource.id, date: source.period.key },
    destination: { resourceId: destination.resource.id, date: destination.period.key },
  });
  const renderTimeItem = useCallback((resource: StaffResource, date: string, item: TimesheetItem, closeOverflow?: () => void) => (
    <TimeItem
      item={item}
      onEdit={canWrite && resource.writable && !isEntryPending(item.id) ? () => { closeOverflow?.(); onEdit({ resourceId: resource.id, date, item }); } : undefined}
      onDelete={canWrite && resource.writable && !isEntryPending(item.id) ? () => { closeOverflow?.(); onDelete({ resourceId: resource.id, date, item }); } : undefined}
    />
  ), [canWrite, isEntryPending, onDelete, onEdit]);
  const buildItem = useCallback(({ resource, period, data: item }: BuildItemContext<StaffResource, TimesheetItem>) => (
    renderTimeItem(resource, period.key, item)
  ), [renderTimeItem]);
  const buildOverflowItem = useCallback((
    { resource, period, data: item }: BuildItemContext<StaffResource, TimesheetItem>,
    { close }: { close: () => void },
  ) => renderTimeItem(resource, period.key, item, close), [renderTimeItem]);
  const openCellEntry = useCallback((
    { resource, period }: CalendarCellContext<StaffResource, TimesheetItem>,
    source: 'regular' | 'task' | 'session',
  ) => onAdd({ resourceId: resource.id, date: period.key, source }), [onAdd]);

  return <>
    {(calendar.error || moveError) && <div className="timesheets-page__error" role="alert">
      <span>{moveError ?? calendar.error}</span>
      {calendar.error && <Button size="sm" variant="secondary" onClick={calendar.retry}>Retry</Button>}
    </div>}
    <ResourceCalendar
      resources={visibleResources}
      data={visibleData}
      initialDate={initialDate}
      positionStorageKey={TIMESHEET_CALENDAR_POSITION_KEY}
      ariaLabel="Staff hours calendar"
      resourceHeader="Name"
      onPeriodsBuilt={calendar.onPeriodsBuilt}
      onInitialPeriods={calendar.initialize}
      onPeriodsReset={calendar.reset}
      onItemDrop={canWrite ? moveTimeEntry : undefined}
      canDropItem={canDropWithinStaff}
      getItemCapabilities={({ resource, data: item }) => ({
        draggable: canWrite && resource.writable && !item.sessionId && !isEntryPending(item.id),
      })}
      maxVisibleItemsPerCell={7}
      rowHeight={112}
      renderOverflowSummary={summarizeOverflow}
      getCellActions={canWrite ? context => context.resource.writable ? [
        { id: 'session', label: 'Session Hours', onSelect: () => openCellEntry(context, 'session') },
        { id: 'task', label: 'Task Hours', onSelect: () => openCellEntry(context, 'task') },
        { id: 'regular', label: 'Regular Hours', onSelect: () => openCellEntry(context, 'regular') },
      ] : [] : undefined}
      getResourceId={getStaffResourceId}
      getItemId={getTimesheetItemId}
      renderResource={({ resource }) => <div className="timesheets-resource">
        <span aria-label={resource.name}>{formatCompactPersonName(resource.firstName, resource.lastName)}</span>
      </div>}
      selectedResourceId={selectedStaffId}
      onResourceSelect={resource => onStaffSelect(resource.id)}
      buildItem={buildItem}
      buildOverflowItem={buildOverflowItem}
    />
  </>;
}
