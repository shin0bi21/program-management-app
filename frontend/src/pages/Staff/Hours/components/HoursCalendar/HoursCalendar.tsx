import { getDate } from '../../../../../common/utils/date';
import type { DateRange } from '../../../../../common/utils/dateRange';
import { useCallback, useMemo, type MutableRefObject, type ReactElement } from 'react';
import TimelineCalendar from '../../../../../common/components/TimelineCalendar/TimelineCalendar';
import UnavailableState from '../../../../../common/components/UnavailableState/UnavailableState';
import usePageMessageReporter from '../../../../../common/components/PageMessageOverlay/usePageMessageReporter';
import type {
  BuildItemContext,
  CalendarCellContext,
  ItemCapabilityContext,
  ItemMoveContext,
  RenderRowContext,
} from '../../../../../common/components/TimelineCalendar/types';
import { formatCompactPersonName } from '../../../../../common/utils/name';
import type { StaffReference } from '../../../../../common/features/referenceData/referenceData.api';
import type {
  HoursActions,
  HoursFilters,
  HoursCalendarIndex,
  Hours,
} from '../../types';
import HoursCalendarItem from './HoursItem/HoursItem';
import useHoursCalendarData from './hooks/useHoursCalendarData';

import './HoursCalendar.css';

const initialDate = getDate();
const HOURS_CALENDAR_POSITION_KEY = 'resource-calendar:hours:position';

interface HoursCalendarProps {
  staff: StaffReference[];
  filters: HoursFilters;
  dateRange?: DateRange;
  canWrite: boolean;
  selectedStaffId?: string;
  calendarIndexRef: MutableRefObject<HoursCalendarIndex | null>;
  actions: HoursActions;

  onStaffSelect: (staffId: string) => void;
}

/**
 * Displays Hours rows from the calendar range buffer.
 * @example <HoursCalendar filters={filters} {...viewProps} />
 */
export default function HoursCalendar({
  staff,
  filters,
  dateRange,
  canWrite,
  selectedStaffId,
  calendarIndexRef,
  actions,

  onStaffSelect,
}: HoursCalendarProps): ReactElement {
  const { staffIds } = filters;
  const calendar = useHoursCalendarData(filters, dateRange, calendarIndexRef);

  const retryAction = useMemo(() => ({ label: 'Retry', onClick: calendar.retry }), [calendar.retry]);
  usePageMessageReporter(undefined, calendar.error, retryAction);

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
    const canModifyEntry = canWrite && row.writable && !actions.isItemPending(entry.id);

    return (
      <HoursCalendarItem
        calendar={itemCalendar}
        item={entry}
        onEdit={canModifyEntry ? () => actions.edit(entry) : undefined}
        onDelete={canModifyEntry ? () => actions.requestDelete(entry) : undefined}
      />
    );
  }, [actions, canWrite]);

  /**
   * Allows dragging only writable entries without session-owned placement or pending changes.
   * @example getItemCapabilities(context) // { draggable: false } for a session entry
   */
  function getItemCapabilities({ row, data }: ItemCapabilityContext<StaffReference, Hours>) {
    const entry = data;
    const draggable = canWrite && row.writable && !entry.sessionId && !actions.isItemPending(entry.id);

    return { draggable };
  }

  /**
   * Sends the destination day to page-owned placement actions.
   * @example moveHours(context) // saves context.nextRange.start
   */
  function moveHours({ item, nextRange }: ItemMoveContext<StaffReference, Hours>) {
    return actions.move(item, nextRange.start);
  }

  /**
   * Offers source-specific entry creation for a writable staff member and day.
   * @example getCellActions(context) // [] for a read-only staff member
   */
  function getCellActions({ row, period }: CalendarCellContext<StaffReference, Hours>) {
    if (!row.writable) return [];

    const target = { staffId: row.id, date: period.key };

    return [
      { id: 'session', label: 'Session Hours', onSelect: () => actions.add({ ...target, type: 'session' }) },
      { id: 'task', label: 'Task Hours', onSelect: () => actions.add({ ...target, type: 'task' }) },
      { id: 'regular', label: 'Regular Hours', onSelect: () => actions.add({ ...target, type: 'regular' }) },
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

      items={calendar.items}
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
    <span className="hours-calendar-staff-name" aria-label={row.name}>
      {formatCompactPersonName(row.firstName, row.lastName)}
    </span>
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
