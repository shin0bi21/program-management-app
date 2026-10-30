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

const PERIOD_WIDTH = 145;
const ROW_WIDTH = 125;
const HEADER_HEIGHT = 40;

type CalendarInteractionState<TRow, TItemData> = ItemInteractionState<TRow, TItemData>
  & Pick<TimelineCalendarProps<TRow, TItemData>, 'onItemMove' | 'onItemResize'>
  & { periods: readonly CalendarPeriod[] };

/**
 * Composes virtual rows/periods, shared pointer coordination, and controlled calendar callbacks.
 * Example: an Item reports a move through Row; the page applies it and supplies updated records.
 */
export default function TimelineCalendar<TRow, TItemData>({
  // Grid layout and accessibility
  ariaLabel = 'Timeline calendar',
  rowHeight = 92,
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

  /** Relays a completed move using the latest committed page callback. */
  function reportItemMove(context: ItemMoveContext<TRow, TItemData>): void {
    void interactionState.current.onItemMove?.(context);
  }

  /** Relays a completed resize using the latest committed page callback. */
  function reportItemResize(context: ItemResizeContext<TRow, TItemData>): void {
    void interactionState.current.onItemResize?.(context);
  }

  const navigationHandler = navigateDate ?? periodDefinition.navigate;
  /** Advances the navigation anchor and scrolls to the resulting date. */
  function navigateCalendar(direction: 'previous' | 'next'): void {
    if (!navigationHandler) return;

    const currentAnchor = getBoundedDate(navigationAnchor, dateRange);
    const requestedAnchor = navigationHandler(currentAnchor, direction);
    const nextAnchor = getBoundedDate(requestedAnchor, dateRange);

    setNavigationAnchor(nextAnchor);
    goToDate(nextAnchor);
  }

  /** Navigates with a fresh current date when the user invokes Today. */
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
 * Clamps a navigation date to an applied inclusive date range.
 * Requires: dateRange, when supplied, contains valid ordered calendar dates.
 * Example: May 4 within a May 1–3 range becomes local midnight on May 3.
 */
function getBoundedDate(date: Date, dateRange?: DateRange): Date {
  if (!dateRange) return date;

  const first = localDateFromKey(dateRange.start);
  const last = localDateFromKey(dateRange.end);
  const boundedTime = Math.max(first.getTime(), Math.min(date.getTime(), last.getTime()));

  return new Date(boundedTime);
}
