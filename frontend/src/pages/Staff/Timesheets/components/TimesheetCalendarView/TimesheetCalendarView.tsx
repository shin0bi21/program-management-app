import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Button from '../../../../../common/components/Button/Button';
import ResourceCalendar from '../../../../../common/components/ResourceCalendar/ResourceCalendar';
import { usePeriodDataBuffer } from '../../../../../common/components/ResourceCalendar/hooks/usePeriodDataBuffer';
import type { PeriodRange } from '../../../../../common/components/ResourceCalendar/PeriodDataBuffer';
import type { BuildItemContext, CalendarCellContext, ItemDropContext } from '../../../../../common/components/ResourceCalendar/types';
import { getTimeEntries, updateTimeEntryPlacement } from '../../../../../common/features/timeEntries/api/timeEntries.api';
import { TIME_ENTRY_CATEGORY_OPTIONS } from '../../../../../common/features/timeEntries/timeEntryOptions';
import type { StaffResource, TimeEntryCategory, TimesheetItem } from '../../../../../common/features/timeEntries/types';
import { formatCompactPersonName } from '../../../../../common/utils/name';
import { useFilteredTimesheetData } from '../../hooks/useFilteredTimesheetData';
import { useItemMutationQueue } from '../../hooks/useItemMutationQueue';
import type { TimesheetEntryType } from '../../hooks/useTimesheetListData';
import TimeItem from '../TimeItem/TimeItem';

const initialDate = new Date();
const TIMESHEET_CALENDAR_POSITION_KEY = 'resource-calendar:timesheets:position';
export type TimesheetEntryTarget = { resourceId: string; date: string; item: TimesheetItem };
export interface TimesheetCalendarMutationCache {
  upsert: (resourceId: string, date: string, item: TimesheetItem) => void;
  remove: (itemId: string) => void;
}

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
  selectedStaffId?: string;
  mutationCacheRef: React.MutableRefObject<TimesheetCalendarMutationCache>;
  onStaffSelect: (staffId: string) => void;
  onEdit: (target: TimesheetEntryTarget) => void;
  onDelete: (target: TimesheetEntryTarget) => void;
  onAdd: (target: { resourceId: string; date: string; source: 'regular' | 'task' | 'session' }) => void;
  onListRefresh: () => Promise<void>;
  onOverviewRefresh: () => void;
}

export default function TimesheetCalendarView({
  resources, staffIds, categories, programIds, types, cycleId, canWrite, selectedStaffId,
  mutationCacheRef, onStaffSelect, onEdit, onDelete, onAdd, onListRefresh, onOverviewRefresh,
}: TimesheetCalendarViewProps) {
  const [moveError, setMoveError] = useState<string | null>(null);
  const { enqueue, isLatest } = useItemMutationQueue();
  const confirmedMoveSourcesRef = useRef(new Map<string, TimesheetEntryTarget>());
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
  const visibleData = useFilteredTimesheetData(calendar.data, categories, programIds, types, cycleId);

  const moveTimeEntry = async ({ item, source, destination }: ItemDropContext<StaffResource, TimesheetItem>) => {
    setMoveError(null);
    const sourceResourceId = source.resource.id;
    const destinationResourceId = destination.resource.id;
    calendar.upsertItem(destinationResourceId, destination.period.key, item);
    const queuedMutation = enqueue(item.id, () => updateTimeEntryPlacement(item.id, { workDate: destination.period.key }));
    if (!queuedMutation.hadPending) {
      confirmedMoveSourcesRef.current.set(item.id, { resourceId: sourceResourceId, date: source.period.key, item });
    }
    try {
      const updated = await queuedMutation.result;
      const categoryLabel = TIME_ENTRY_CATEGORY_OPTIONS.find(option => option.value === updated.category)?.label ?? updated.category;
      const confirmed = { ...updated, categoryLabel };
      confirmedMoveSourcesRef.current.set(item.id, { resourceId: destinationResourceId, date: destination.period.key, item: confirmed });
      if (!isLatest(item.id, queuedMutation.revision)) return;
      calendar.upsertItem(destinationResourceId, destination.period.key, confirmed);
      confirmedMoveSourcesRef.current.delete(item.id);
      onOverviewRefresh();
      await onListRefresh();
    } catch {
      if (!isLatest(item.id, queuedMutation.revision)) return;
      const confirmed = confirmedMoveSourcesRef.current.get(item.id);
      if (confirmed) calendar.upsertItem(confirmed.resourceId, confirmed.date, confirmed.item);
      confirmedMoveSourcesRef.current.delete(item.id);
      setMoveError('Unable to move logged hours. The hours were returned to their original day.');
    }
  };
  const renderTimeItem = useCallback((resource: StaffResource, date: string, item: TimesheetItem, closeOverflow?: () => void) => (
    <TimeItem
      item={item}
      onEdit={canWrite && resource.writable ? () => { closeOverflow?.(); onEdit({ resourceId: resource.id, date, item }); } : undefined}
      onDelete={canWrite && resource.writable ? () => { closeOverflow?.(); onDelete({ resourceId: resource.id, date, item }); } : undefined}
    />
  ), [canWrite, onDelete, onEdit]);
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
      getItemCapabilities={({ resource, data: item }) => ({ draggable: canWrite && resource.writable && !item.sessionId })}
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
