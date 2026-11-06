import { localDateFromKey, type DateRange } from '../../utils/dateRange';
import { useLayoutEffect, useRef, useState } from 'react';
import { usePeriodVirtualization } from './hooks/usePeriodVirtualization/usePeriodVirtualization';
import { usePointerSession } from './hooks/usePointerSession/usePointerSession';
import { useRowVirtualization } from './hooks/useRowVirtualization/useRowVirtualization';
import { useToday } from './hooks/useToday/useToday';
import Toolbar from './components/Toolbar/Toolbar';
import Grid from './components/Grid/Grid';
import { dayPeriodDefinition } from './utils/periods';
import type {
  CalendarPeriod,
  ItemMoveContext,
  ItemResizeContext,
  TimelineCalendarProps,
  ItemInteractionState,
  ItemEnvironment,
} from './types';
import { loadCalendarPosition } from './utils/calendarPosition';
import './TimelineCalendar.css';

const PERIOD_WIDTH = 150;
const ROW_WIDTH = 150;
const HEADER_HEIGHT = 40;

type CalendarInteractionState<TRow, TItemData> = ItemInteractionState<TRow, TItemData>
  & Pick<TimelineCalendarProps<TRow, TItemData>, 'onItemMove' | 'onItemResize'>
  & { periods: readonly CalendarPeriod[] };

/**
 * Displays items across date columns and resource rows, rendering only the nearby rows/columns.
 * Initial position is read once on mount; callers own item updates and handle rejected save requests.
 * @param props.rows - Resources shown down the calendar, such as staff members or programs.
 * @param props.items - Calendar records grouped by resource row ID, such as each staff member's tasks.
 * @param props.getItemRange - First and last periods occupied by a record, both included.
 * @param props.buildItem - Renders a record; pass its calendar argument to the shared Item component.
 * @param props.dateRange - Earliest/latest dates the user may navigate to; both included.
 * @param props.periodDefinition - Builds a nonempty chronological window containing the restored or initial anchor; dateRange always builds days.
 * @param props.positionStorageKey - Browser storage key for remembering scroll position.
 * @param props.onRowSelect - Reports the selected resource and whether a row header or item selected it.
 * @param props.onItemMove - Saves an item's new date range and destination resource.
 * @param props.onItemResize - Saves an item's changed start or end date.
 * @example With staff rows and task items, a May 1–3 task spans three day columns in its assignee's row.
 */
export default function TimelineCalendar<TRow, TItemData>({
  // Grid layout and accessibility
  ariaLabel = 'Timeline calendar',
  rowHeight = 150,
  overscanRows = 3,

  // Periods and range loading
  periodDefinition = dayPeriodDefinition,
  initialDate = new Date(),
  positionStorageKey,
  periodCount = 2500,
  dateRange,
  overscanPeriods,
  onInitialPeriods,
  onPeriodsBuilt,
  onPeriodsReset,

  // Toolbar navigation
  showToolbar = true,
  showTodayButton = true,
  navigateDate,

  // Rows and selection
  rows,
  rowHeader = 'Row',
  getRowId,
  renderRow,
  selectedRowId,
  onRowSelect,

  // Item data and rendering
  items,
  getItemId,
  getItemRange,
  buildItem,
  getItemCapabilities,

  // Item interactions
  onItemActivate,
  canItemMove,
  onItemMove,
  onItemResize,
  dragEdgeSize = 72,
  dragScrollSpeed = 14,

  // Cell actions
  onCellActivate,
  getCellActions,
}: TimelineCalendarProps<TRow, TItemData>) {
  const [initialPosition] = useState(() => loadCalendarPosition(positionStorageKey, initialDate));
  const [navigationAnchor, setNavigationAnchor] = useState(() => new Date(initialPosition.date));

  const effectiveOverscan = overscanPeriods ?? 14;
  const { periods, allPeriods, viewportRef, goToDate, visibleYear, leadingPeriodWidth, trailingPeriodWidth } = usePeriodVirtualization({
    periodDefinition,
    initialDate: initialPosition.date,
    initialOffset: initialPosition.offset,
    positionStorageKey,
    periodCount,
    dateRange,
    overscan: effectiveOverscan,
    periodWidth: PERIOD_WIDTH,
    coveredLeftWidth: ROW_WIDTH,
    onPeriodsBuilt,
    onInitialPeriods,
    onPeriodsReset,
  });

  const visibleRows = useRowVirtualization(
    rows,
    viewportRef,
    rowHeight,
    HEADER_HEIGHT,
    overscanRows,
  );

  const gridColumns = `${ROW_WIDTH}px ${leadingPeriodWidth}px repeat(${periods.length}, ${PERIOD_WIDTH}px) ${trailingPeriodWidth}px`;
  const { today, refreshDate } = useToday();
  const todayIsInRange = today >= allPeriods[0].start && today < allPeriods[allPeriods.length - 1].end;

  const pointer = usePointerSession();
  const interactionState = useRef<CalendarInteractionState<TRow, TItemData>>({
    periods: allPeriods, rows, getRowId, canItemMove, onItemMove, onItemResize,
    moveEnabled: Boolean(onItemMove), resizeEnabled: Boolean(onItemResize),
  });
  useLayoutEffect(() => {
    // Active sessions can outlive a virtualized Item; publish only committed calendar props.
    interactionState.current = {
      periods: allPeriods, rows, getRowId, canItemMove, onItemMove, onItemResize,
      moveEnabled: Boolean(onItemMove), resizeEnabled: Boolean(onItemResize),
    };
  }, [allPeriods, rows, getRowId, canItemMove, onItemMove, onItemResize]);

  const itemEnvironment: ItemEnvironment = {
    viewportRef,
    getPeriods: () => interactionState.current.periods,
    periodWidth: PERIOD_WIDTH,
    coveredLeftWidth: ROW_WIDTH,
    dragEdgeSize,
    dragScrollSpeed,
    onPointerSessionRequest: pointer.startPointerSession,
    onClickSuppressionRequest: pointer.suppressNextClick,
    isClickSuppressed: pointer.isClickSuppressed,
  };

  /**
   * Sends a completed move to the latest committed save callback without awaiting completion.
   * @param context - Original item and range, destination row, and requested inclusive range; the callback handles failures.
   * @example A session surviving Item unmount still invokes the current page move action.
   */
  function reportItemMove(context: ItemMoveContext<TRow, TItemData>): void {
    void interactionState.current.onItemMove?.(context);
  }

  /**
   * Sends a completed resize to the latest committed save callback without awaiting completion.
   * @param context - Original item and range, changed edge, and requested inclusive range; the callback handles failures.
   * @example Resizing a task reports its changed range to the latest task action owner.
   */
  function reportItemResize(context: ItemResizeContext<TRow, TItemData>): void {
    void interactionState.current.onItemResize?.(context);
  }

  const navigationHandler = navigateDate ?? periodDefinition.navigate;
  /**
   * Advances and clamps the navigation anchor before scrolling; no handler means no action.
   * @param direction - Whether to request the preceding or following date from the configured navigation handler.
   * @example Navigating beyond an applied May 1–3 range stops at May 3.
   */
  function navigateCalendar(direction: 'previous' | 'next'): void {
    if (!navigationHandler) return;

    const currentAnchor = getBoundedDate(navigationAnchor, dateRange);
    const requestedAnchor = navigationHandler(currentAnchor, direction);
    const nextAnchor = getBoundedDate(requestedAnchor, dateRange);

    setNavigationAnchor(nextAnchor);
    goToDate(nextAnchor);
  }

  /**
   * Refreshes the clock and navigates only when today belongs to the built period range.
   * @example Today outside the selected cycle bounds leaves the viewport unchanged.
   */
  function goToToday(): void {
    const today = refreshDate();
    if (today < allPeriods[0].start || today >= allPeriods[allPeriods.length - 1].end) return;

    setNavigationAnchor(today);
    goToDate(today);
  }

  return (
    <div className="timeline-calendar">
      {showToolbar && (
        <Toolbar
          year={visibleYear}
          onToday={showTodayButton ? goToToday : undefined}
          todayDisabled={!todayIsInRange}
          onPrevious={navigationHandler ? () => navigateCalendar('previous') : undefined}
          onNext={navigationHandler ? () => navigateCalendar('next') : undefined}
        />
      )}
      <div
        ref={viewportRef}
        className={`body${pointer.activeType ? ` ${pointer.activeType}` : ''}`}
        role="grid"
        aria-label={ariaLabel}
      >
        <Grid
          gridColumns={gridColumns}
          rowHeight={rowHeight}
          leadingPeriodWidth={leadingPeriodWidth}
          topSpacerHeight={visibleRows.first * rowHeight}
          bottomSpacerHeight={(rows.length - visibleRows.last) * rowHeight}

          periods={periods}
          formatPeriodLabel={periodDefinition.formatLabel}
          today={today}

          rows={visibleRows.rows}
          firstRowIndex={visibleRows.first}
          rowHeader={rowHeader}
          getRowId={getRowId}
          renderRow={renderRow}
          selectedRowId={selectedRowId}
          onRowSelect={onRowSelect}

          items={items}
          getItemId={getItemId}
          getItemRange={getItemRange}
          buildItem={buildItem}
          getItemCapabilities={getItemCapabilities}

          itemMoveEnabled={!!onItemMove}
          itemResizeEnabled={!!onItemResize}
          itemEnvironment={itemEnvironment}
          itemState={interactionState}
          onItemActivate={onItemActivate}
          onItemMove={reportItemMove}
          onItemResize={reportItemResize}

          onCellClick={onCellActivate}
          getCellActions={getCellActions}
        />
      </div>
    </div>
  );
}

/**
 * Keeps a requested navigation date within the calendar's allowed dates.
 * @param date - Date the user is trying to navigate to.
 * @param dateRange - Valid ordered earliest/latest dates, both included; omit to leave date unchanged.
 * @returns The original date when no bounds apply, or a new date clamped between local-midnight boundaries.
 * @example Navigating to May 4 with May 1–3 bounds returns local midnight on May 3.
 */
function getBoundedDate(date: Date, dateRange?: DateRange): Date {
  if (!dateRange) return date;

  const first = localDateFromKey(dateRange.start);
  const last = localDateFromKey(dateRange.end);
  const boundedTime = Math.max(first.getTime(), Math.min(date.getTime(), last.getTime()));

  return new Date(boundedTime);
}
