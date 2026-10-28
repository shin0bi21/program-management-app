import { useState } from 'react';
import { usePeriodVirtualization } from './hooks/usePeriodVirtualization/usePeriodVirtualization';
import { useItemMove } from './hooks/useItemMove/useItemMove';
import { useItemResize } from './hooks/useItemResize/useItemResize';
import { usePointerSession } from './hooks/usePointerSession/usePointerSession';
import { useRowVirtualization } from './hooks/useRowVirtualization/useRowVirtualization';
import Toolbar from './components/Toolbar/Toolbar';
import Grid from './components/Grid/Grid';
import { dayPeriodDefinition } from './utils/periods';
import type { TimelineCalendarProps } from './types';
import { loadCalendarPosition } from './utils/calendarPosition';
import './TimelineCalendar.css';

const PERIOD_WIDTH = 145;
const ROW_WIDTH = 125;
const HEADER_HEIGHT = 40;

export default function TimelineCalendar<TRow, TItemData>({
  rows,
  items,
  getItemRange,
  getRowId,
  getItemId,
  renderRow,
  selectedRowId,
  onRowSelect,
  buildItem,
  getItemCapabilities,
  onItemActivate,
  onItemResize,
  onItemMove,
  canItemMove,
  onCellActivate,
  getCellActions,
  periodDefinition = dayPeriodDefinition,
  ariaLabel = 'Timeline calendar',
  rowHeader = 'Row',
  initialDate = new Date(),
  positionStorageKey,
  periodCount = 2500,
  overscanPeriods,
  rowHeight = 92,
  overscanRows = 3,
  onPeriodsBuilt,
  onInitialPeriods,
  onPeriodsReset,
  showToolbar = true,
  showTodayButton = true,
  navigateDate,
  dragEdgeSize = 72,
  dragScrollSpeed = 14,
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
  const [today] = useState(() => new Date());

  const { activeType: activeInteraction, beginPointerSession } = usePointerSession();
  const { onItemMovePointerDown, suppressClickRef: suppressMoveClickRef } = useItemMove({
    viewportRef, periods: allPeriods, periodWidth: PERIOD_WIDTH, rows, getRowId, canItemMove, onItemMove,
    dragEdgeSize, dragScrollSpeed, coveredLeftWidth: ROW_WIDTH,
    beginPointerSession,
  });

  const { onItemResizePointerDown, onItemResizeKeyDown, suppressClickRef: suppressResizeClickRef } = useItemResize({
    viewportRef, allPeriods, periodWidth: PERIOD_WIDTH, coveredLeftWidth: ROW_WIDTH, onItemResize,
    dragEdgeSize, dragScrollSpeed,
    beginPointerSession,
  });

  const navigationHandler = navigateDate ?? periodDefinition.navigate;
  const navigate = (direction: 'previous' | 'next') => {
    if (!navigationHandler) return;

    const nextAnchor = navigationHandler(navigationAnchor, direction);

    setNavigationAnchor(nextAnchor);
    goToDate(nextAnchor);
  };

  const goToToday = () => {
    const today = new Date();

    setNavigationAnchor(today);
    goToDate(today);
  };

  return (
    <div className="timeline-calendar">
      {showToolbar && (
        <Toolbar
          year={visibleYear}
          onToday={showTodayButton ? goToToday : undefined}
          onPrevious={navigationHandler ? () => navigate('previous') : undefined}
          onNext={navigationHandler ? () => navigate('next') : undefined}
        />
      )}
      <div
        ref={viewportRef}
        className={`body${activeInteraction ? ` ${activeInteraction}` : ''}`}
        role="grid"
        aria-label={ariaLabel}
      >
        <Grid
          rows={visibleRows.rows}
          firstRowIndex={visibleRows.first}
          periods={periods}
          leadingPeriodWidth={leadingPeriodWidth}
          items={items}
          getItemRange={getItemRange}
          gridColumns={gridColumns}
          rowHeight={rowHeight}
          topSpacerHeight={visibleRows.first * rowHeight}
          bottomSpacerHeight={(rows.length - visibleRows.last) * rowHeight}
          rowHeader={rowHeader}
          getRowId={getRowId}
          getItemId={getItemId}
          renderRow={renderRow}
          selectedRowId={selectedRowId}
          onRowSelect={onRowSelect}
          buildItem={buildItem}
          getItemCapabilities={getItemCapabilities}
          onItemActivate={onItemActivate}
          itemResizeEnabled={!!onItemResize}
          onItemResizePointerDown={onItemResizePointerDown}
          onItemResizeKeyDown={onItemResizeKeyDown}
          suppressResizeClickRef={suppressResizeClickRef}
          itemMoveEnabled={!!onItemMove}
          onItemMovePointerDown={onItemMovePointerDown}
          suppressMoveClickRef={suppressMoveClickRef}
          onCellClick={onCellActivate}
          getCellActions={getCellActions}
          formatPeriodLabel={periodDefinition.formatLabel}
          today={today}
        />
      </div>
    </div>
  );
}
