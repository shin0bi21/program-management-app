import { getDate } from '../../../../../common/utils/date';
import { useCallback, useMemo, type MutableRefObject } from 'react';
import TimelineCalendar from '../../../../../common/components/TimelineCalendar/TimelineCalendar';
import UnavailableState from '../../../../../common/components/UnavailableState/UnavailableState';
import usePageMessageReporter, { type PageMessageChangeHandler } from '../../../../../common/components/PageMessageOverlay/usePageMessageReporter';
import type {
  BuildItemContext,
  CalendarCellContext,
  ItemCapabilityContext,
  ItemMoveContext,
  RenderRowContext,
} from '../../../../../common/components/TimelineCalendar/types';
import { formatCompactPersonName } from '../../../../../common/utils/name';
import type {
  StaffResource,
  HoursFilters,
  HoursCalendarIndex,
  HoursItemMove,
  HoursItem,
} from '../../types';
import HoursCalendarItem from './HoursItem/HoursItem';
import useHoursCalendarData from './hooks/useHoursCalendarData';

const initialDate = getDate();
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

/**
 * Displays Hours rows from the calendar range buffer.
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
  const { staffIds, dateRange } = filters;
  const { calendar, visibleItems } = useHoursCalendarData(filters, calendarIndexRef);

  const retryAction = useMemo(() => ({ label: 'Retry', onClick: calendar.retry }), [calendar.retry]);
  usePageMessageReporter(onMessageChange, calendar.error, retryAction);

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

  /**
   * Allows dragging only writable entries without session-owned placement or pending changes.
   * @example getItemCapabilities(context) // { draggable: false } for a session entry
   */
  function getItemCapabilities({ row, data }: ItemCapabilityContext<StaffResource, HoursItem>) {
    const entry = data;
    const draggable = canWrite && row.writable && !entry.sessionId && !isItemPending(entry.id);

    return { draggable };
  }

  /**
   * Sends the destination day to page-owned placement actions.
   * @example moveHours(context) // saves context.nextRange.start
   */
  function moveHours({ item, nextRange }: ItemMoveContext<StaffResource, HoursItem>) {
    return onMove({ item, date: nextRange.start });
  }

  /**
   * Offers source-specific entry creation for a writable staff member and day.
   * @example getCellActions(context) // [] for a read-only staff member
   */
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

/** Identifies a staff calendar row. @example getStaffResourceId(staff) // staff.id */
const getStaffResourceId = (resource: StaffResource) => resource.id;
/** Identifies a saved entry in a calendar membership index. @example getHoursItemId(entry) // entry.id */
const getHoursItemId = (item: HoursItem) => item.id;
/** Places an entry on its logged day. @example getHoursItemRange(entry) // { start: entry.date, end: entry.date } */
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
