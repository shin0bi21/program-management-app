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
  StaffReference,
  HoursFilters,
  HoursCalendarIndex,
  HoursItemMove,
  Hours,
} from '../../types';
import HoursCalendarItem from './HoursItem/HoursItem';
import useHoursCalendarData from './hooks/useHoursCalendarData';

const initialDate = getDate();
const HOURS_CALENDAR_POSITION_KEY = 'resource-calendar:hours:position';

interface HoursCalendarProps {
  staff: StaffReference[];
  filters: HoursFilters;
  canWrite: boolean;
  selectedStaffId?: string;
  calendarIndexRef: MutableRefObject<HoursCalendarIndex>;
  isItemPending: (itemId: string) => boolean;

  onStaffSelect: (staffId: string) => void;
  onEdit: (target: Hours) => void;
  onDelete: (target: Hours) => void;
  onAdd: (target: { staffId: string; date: string; source: 'regular' | 'task' | 'session' }) => void;
  onMove: (move: HoursItemMove) => Promise<void>;
  onMessageChange?: PageMessageChangeHandler;
}

/**
 * Displays Hours rows from the calendar range buffer.
 * @example <HoursCalendar filters={filters} {...viewProps} />
 */
export default function HoursCalendar({
  staff,
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

  const visibleStaff = useMemo(() => {
    if (!staffIds.length) return staff;

    return staff.filter(staffMember => staffIds.includes(staffMember.id));
  }, [staffIds, staff]);

  const buildItem = useCallback(({
    row,
    data,
    calendar: itemCalendar,
  }: BuildItemContext<StaffReference, Hours>) => {
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
  function getItemCapabilities({ row, data }: ItemCapabilityContext<StaffReference, Hours>) {
    const entry = data;
    const draggable = canWrite && row.writable && !entry.sessionId && !isItemPending(entry.id);

    return { draggable };
  }

  /**
   * Sends the destination day to page-owned placement actions.
   * @example moveHours(context) // saves context.nextRange.start
   */
  function moveHours({ item, nextRange }: ItemMoveContext<StaffReference, Hours>) {
    return onMove({ item, date: nextRange.start });
  }

  /**
   * Offers source-specific entry creation for a writable staff member and day.
   * @example getCellActions(context) // [] for a read-only staff member
   */
  function getCellActions({ row, period }: CalendarCellContext<StaffReference, Hours>) {
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
    <TimelineCalendar<StaffReference, Hours>
      ariaLabel="Staff hours calendar"
      initialDate={initialDate}
      dateRange={dateRange}
      positionStorageKey={HOURS_CALENDAR_POSITION_KEY}
      onPeriodsBuilt={calendar.onPeriodsBuilt}
      onInitialPeriods={calendar.initialize}
      onPeriodsReset={calendar.reset}

      rows={visibleStaff}
      rowHeader="Name"
      getRowId={getStaffId}
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

/** Identifies a staff calendar row. @example getStaffId(staff) // staff.id */
function getStaffId(staffMember: StaffReference) {
  return staffMember.id;
}
/**
 * Displays the staff member for a calendar row.
 * @example renderStaffRow(context) // compact staff name
 */
function renderStaffRow({ row }: RenderRowContext<StaffReference>) {
  return (
    <div className="hours-staff">
      <span aria-label={row.name}>{formatCompactPersonName(row.firstName, row.lastName)}</span>
    </div>
  );
}


/** Identifies a saved entry in a calendar membership index. @example getHoursItemId(entry) // entry.id */
function getHoursItemId(item: Hours) {
  return item.id;
}
/** Places an entry on its logged day. @example getHoursItemRange(entry) // { start: entry.date, end: entry.date } */
function getHoursItemRange(data: Hours) {
  return { start: data.date, end: data.date };
}


/**
 * Allows a move only within the same writable staff row.
 * @example canMoveWithinStaff(context) // false when destination staff differs
 */
function canMoveWithinStaff({ row, destinationRow }: ItemMoveContext<StaffReference, Hours>) {
  return row.writable && destinationRow.writable && row.id === destinationRow.id;
}
