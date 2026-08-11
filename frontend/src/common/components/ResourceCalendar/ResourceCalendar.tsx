import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { usePeriodWindow } from './hooks/usePeriodWindow';
import { useCalendarItemDrag } from './hooks/useCalendarItemDrag';
import { useCalendarViewport } from './hooks/useCalendarViewport';
import { useCalendarRangeResize } from './hooks/useCalendarRangeResize';
import { useCalendarRangeMove } from './hooks/useCalendarRangeMove';
import { useVirtualizedRows } from './hooks/useVirtualizedRows';
import ResourceCalendarToolbar from './components/ResourceCalendarToolbar';
import ResourceCalendarGrid from './components/ResourceCalendarGrid';
import {
  calculateGroupedPeriodWindow,
  calculateVisiblePeriodCount,
  normalizePeriodGroupSize,
} from './utils/periodWindowSizing';
import { dayPeriodDefinition } from './periods';
import type { ResourceCalendarProps } from './types';
import { getCalendarPreviewHostStyle } from './utils/rangePreview';
import { loadCalendarPosition } from './utils/calendarPosition';
import './ResourceCalendar.css';
import './components/CalendarItem.css';

const PERIOD_WIDTH = 152;
const RESOURCE_WIDTH = 190;
const HEADER_HEIGHT = 58;
export default function ResourceCalendar<TResource, TItemData>({
  resources,
  data,
  rangeData,
  getItemRange,
  getResourceId,
  getItemId,
  renderResource,
  selectedResourceId,
  onResourceSelect,
  buildItem,
  buildRangeItem,
  getItemCapabilities,
  onItemActivate,
  onRangeResize,
  onRangeMove,
  canRangeMove,
  buildOverflowItem,
  canDropItem,
  onItemDrop,
  onCellActivate,
  getCellActions,
  maxVisibleItemsPerCell = 1,
  renderOverflowSummary,
  periodDefinition = dayPeriodDefinition,
  ariaLabel = 'Resource calendar',
  resourceHeader = 'Resource',
  initialDate = new Date(),
  positionStorageKey,
  initialVisiblePeriodCount = 15,
  periodBuildSize,
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
}: ResourceCalendarProps<TResource, TItemData>) {
  const [scrollTop, setScrollTop] = useState(0);
  const [initialPosition] = useState(() => loadCalendarPosition(positionStorageKey, initialDate));
  const [navigationAnchor, setNavigationAnchor] = useState(() => new Date(initialPosition.date));
  const periodGroupSize = normalizePeriodGroupSize(periodDefinition.groupSize);
  const [measuredWidth, setMeasuredWidth] = useState<number | null>(null);
  const visiblePeriodCount = measuredWidth && measuredWidth > RESOURCE_WIDTH
    ? calculateVisiblePeriodCount(measuredWidth, RESOURCE_WIDTH, PERIOD_WIDTH)
    : initialVisiblePeriodCount;
  const calculatedInitialPeriodCount = calculateGroupedPeriodWindow(visiblePeriodCount, periodGroupSize);
  const effectivePeriodBuildSize = periodBuildSize ?? periodGroupSize;
  const { periods, viewportRef, goToDate } = usePeriodWindow({
    periodDefinition,
    initialDate: initialPosition.date,
    initialOffset: initialPosition.offset,
    positionStorageKey,
    initialPeriodCount: calculatedInitialPeriodCount,
    periodBuildSize: effectivePeriodBuildSize,
    periodWidth: PERIOD_WIDTH,
    coveredLeftWidth: RESOURCE_WIDTH,
    onPeriodsBuilt,
    onInitialPeriods,
    ready: measuredWidth !== null,
    onPeriodsReset,
  });
  const viewport = useCalendarViewport(viewportRef);
  useEffect(() => {
    if (viewport.initialWidth !== null) setMeasuredWidth(current => current ?? viewport.initialWidth);
  }, [viewport.initialWidth]);
  const visibleRows = useVirtualizedRows(
    resources,
    scrollTop,
    viewport.height,
    rowHeight,
    HEADER_HEIGHT,
    overscanRows,
  );

  const gridColumns = `${RESOURCE_WIDTH}px repeat(${periods.length}, ${PERIOD_WIDTH}px)`;
  const [today] = useState(() => new Date());

  const { drag, beginDrag, overlayRef, suppressClickRef } = useCalendarItemDrag({
    viewportRef,
    resources,
    periods,
    getResourceId,
    canDropItem,
    onItemDrop,
    dragEdgeSize,
    dragScrollSpeed,
    coveredLeftWidth: RESOURCE_WIDTH,
  });
  const { beginResize, resizeByKeyboard, suppressClickRef: suppressResizeClickRef } = useCalendarRangeResize({
    viewportRef, periods, periodWidth: PERIOD_WIDTH, coveredLeftWidth: RESOURCE_WIDTH, onRangeResize,
    dragEdgeSize, dragScrollSpeed,
  });
  const { beginRangeMove, suppressRangeMoveClickRef } = useCalendarRangeMove({
    viewportRef, periods, periodWidth: PERIOD_WIDTH, resources, getResourceId, canRangeMove, onRangeMove,
    dragEdgeSize, dragScrollSpeed, coveredLeftWidth: RESOURCE_WIDTH,
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
    <div className="resource-calendar-shell">
      {showToolbar && (
        <ResourceCalendarToolbar
          onToday={showTodayButton ? goToToday : undefined}
          onPrevious={navigationHandler ? () => navigate('previous') : undefined}
          onNext={navigationHandler ? () => navigate('next') : undefined}
        />
      )}
      <div
        ref={viewportRef}
        className="resource-calendar"
        onScroll={event => setScrollTop(event.currentTarget.scrollTop)}
        aria-label={ariaLabel}
      >
        <ResourceCalendarGrid
          resources={visibleRows.resources}
          firstResourceIndex={visibleRows.first}
          periods={periods}
          data={data}
          rangeData={rangeData}
          getItemRange={getItemRange}
          gridColumns={gridColumns}
          rowHeight={rowHeight}
          topSpacerHeight={visibleRows.first * rowHeight}
          bottomSpacerHeight={(resources.length - visibleRows.last) * rowHeight}
          resourceHeader={resourceHeader}
          getResourceId={getResourceId}
          getItemId={getItemId}
          renderResource={renderResource}
          selectedResourceId={selectedResourceId}
          onResourceSelect={onResourceSelect}
          buildItem={buildItem}
          buildRangeItem={buildRangeItem}
          getItemCapabilities={getItemCapabilities}
          onItemActivate={onItemActivate}
          rangeResizeEnabled={!!onRangeResize}
          beginResize={beginResize}
          resizeByKeyboard={resizeByKeyboard}
          suppressResizeClickRef={suppressResizeClickRef}
          rangeMoveEnabled={!!onRangeMove}
          beginRangeMove={beginRangeMove}
          suppressRangeMoveClickRef={suppressRangeMoveClickRef}
          buildOverflowItem={buildOverflowItem}
          onItemDropEnabled={!!onItemDrop}
          onCellClick={onCellActivate}
          getCellActions={getCellActions}
          maxVisibleItemsPerCell={maxVisibleItemsPerCell}
          renderOverflowSummary={renderOverflowSummary}
          beginDrag={beginDrag}
          suppressClickRef={suppressClickRef}
          formatPeriodLabel={periodDefinition.formatLabel}
          today={today}
        />
      </div>
      {drag?.dragging && createPortal(
        <div className="resource-calendar__preview-host" style={getCalendarPreviewHostStyle(drag.previewBounds!)}>
          <div
            ref={overlayRef}
            className="resource-calendar__drag-overlay"
            style={{ left: 0, top: 0, width: drag.width }}
            aria-hidden="true"
          >
            {buildItem(drag.context)}
          </div>
        </div>,
        document.body,
      )}
    </div>
  );
}
