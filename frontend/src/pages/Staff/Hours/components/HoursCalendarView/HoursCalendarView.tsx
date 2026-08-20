import { useCallback, useEffect, useMemo } from 'react';
import Button from '../../../../../common/components/Button/Button';
import ResourceCalendar from '../../../../../common/components/ResourceCalendar/ResourceCalendar';
import { usePeriodDataBuffer } from '../../../../../common/components/ResourceCalendar/data/usePeriodDataBuffer';
import type { PeriodRange } from '../../../../../common/components/ResourceCalendar/data/PeriodDataBuffer';
import type { BuildItemContext, CalendarCellContext, ItemDropContext } from '../../../../../common/components/ResourceCalendar/types';
import { getHours } from '../../../../../common/features/hours/hours.api';
import type { StaffResource, HoursCategory, HoursItem } from '../../../../../common/features/hours/types';
import { formatCompactPersonName } from '../../../../../common/utils/name';
import type {
  HoursCalendarCache,
  HoursEntryMove,
  HoursEntryTarget,
  HoursEntryType,
} from '../../types';
import { useHoursCalendarData } from './hooks/useHoursCalendarData';
import TimeItem from './TimeItem/TimeItem';

const initialDate = new Date();
const HOURS_CALENDAR_POSITION_KEY = 'resource-calendar:hours:position';
const getStaffResourceId = (resource: StaffResource) => resource.id;
const getHoursItemId = (item: HoursItem) => item.id;
const canDropWithinStaff = ({ source, destination }: ItemDropContext<StaffResource, HoursItem>) => source.resource.writable
  && destination.resource.writable
  && source.resource.id === destination.resource.id;
const summarizeOverflow = ({ items, itemCount }: { items: readonly HoursItem[]; itemCount: number }) => (
  `${itemCount} ${itemCount === 1 ? 'Entry' : 'Entries'} - ${items.reduce((total, item) => total + item.hours, 0)} Hours`
);

interface HoursCalendarViewProps {
  resources: StaffResource[];
  staffIds: string[];
  categories: HoursCategory[];
  programIds: string[];
  types: HoursEntryType[];
  cycleId: string;
  canWrite: boolean;
  moveError: string | null;
  selectedStaffId?: string;
  calendarCacheRef: React.MutableRefObject<HoursCalendarCache>;
  isEntryPending: (entryId: string) => boolean;
  onStaffSelect: (staffId: string) => void;
  onEdit: (target: HoursEntryTarget) => void;
  onDelete: (target: HoursEntryTarget) => void;
  onAdd: (target: { resourceId: string; date: string; source: 'regular' | 'task' | 'session' }) => void;
  onMove: (move: HoursEntryMove) => Promise<void>;
}

export default function HoursCalendarView({
  resources, staffIds, categories, programIds, types, cycleId, canWrite, moveError, selectedStaffId,
  calendarCacheRef, isEntryPending, onStaffSelect, onEdit, onDelete, onAdd, onMove,
}: HoursCalendarViewProps) {
  const loadRange = useCallback(async ({ start, end }: PeriodRange) => (
    (await getHours({ start: start.key, end: end.key })).data
  ), []);
  const calendar = usePeriodDataBuffer({
    load: loadRange,
    getItemId: getHoursItemId,
    errorMessage: 'Unable to load hours data',
  });
  useEffect(() => {
    calendarCacheRef.current = { upsert: calendar.upsertItem, remove: calendar.removeItem };
    return () => { calendarCacheRef.current = { upsert: () => undefined, remove: () => undefined }; };
  }, [calendar.removeItem, calendar.upsertItem, calendarCacheRef]);
  const visibleResources = useMemo(() => staffIds.length
    ? resources.filter(resource => staffIds.includes(resource.id))
    : resources, [resources, staffIds]);
  const visibleData = useHoursCalendarData(calendar.data, categories, programIds, types, cycleId);

  const moveHours = ({ item, source, destination }: ItemDropContext<StaffResource, HoursItem>) => onMove({
    item,
    source: { resourceId: source.resource.id, date: source.period.key },
    destination: { resourceId: destination.resource.id, date: destination.period.key },
  });
  const renderTimeItem = useCallback((resource: StaffResource, date: string, item: HoursItem, closeOverflow?: () => void) => (
    <TimeItem
      item={item}
      onEdit={canWrite && resource.writable && !isEntryPending(item.id) ? () => { closeOverflow?.(); onEdit({ resourceId: resource.id, date, item }); } : undefined}
      onDelete={canWrite && resource.writable && !isEntryPending(item.id) ? () => { closeOverflow?.(); onDelete({ resourceId: resource.id, date, item }); } : undefined}
    />
  ), [canWrite, isEntryPending, onDelete, onEdit]);
  const buildItem = useCallback(({ resource, period, data: item }: BuildItemContext<StaffResource, HoursItem>) => (
    renderTimeItem(resource, period.key, item)
  ), [renderTimeItem]);
  const buildOverflowItem = useCallback((
    { resource, period, data: item }: BuildItemContext<StaffResource, HoursItem>,
    { close }: { close: () => void },
  ) => renderTimeItem(resource, period.key, item, close), [renderTimeItem]);
  const openCellEntry = useCallback((
    { resource, period }: CalendarCellContext<StaffResource, HoursItem>,
    source: 'regular' | 'task' | 'session',
  ) => onAdd({ resourceId: resource.id, date: period.key, source }), [onAdd]);

  return <>
    {(calendar.error || moveError) && <div className="hours-page__error" role="alert">
      <span>{moveError ?? calendar.error}</span>
      {calendar.error && <Button size="sm" variant="secondary" onClick={calendar.retry}>Retry</Button>}
    </div>}
    <ResourceCalendar
      resources={visibleResources}
      data={visibleData}
      initialDate={initialDate}
      positionStorageKey={HOURS_CALENDAR_POSITION_KEY}
      ariaLabel="Staff hours calendar"
      resourceHeader="Name"
      onPeriodsBuilt={calendar.onPeriodsBuilt}
      onInitialPeriods={calendar.initialize}
      onPeriodsReset={calendar.reset}
      onItemDrop={canWrite ? moveHours : undefined}
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
      getItemId={getHoursItemId}
      renderResource={({ resource }) => <div className="hours-resource">
        <span aria-label={resource.name}>{formatCompactPersonName(resource.firstName, resource.lastName)}</span>
      </div>}
      selectedResourceId={selectedStaffId}
      onResourceSelect={resource => onStaffSelect(resource.id)}
      buildItem={buildItem}
      buildOverflowItem={buildOverflowItem}
    />
  </>;
}
