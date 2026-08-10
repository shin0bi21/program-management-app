import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { usePeriodWindow } from './hooks/usePeriodWindow';
import { useCalendarItemDrag } from './hooks/useCalendarItemDrag';
import { useCalendarViewport } from './hooks/useCalendarViewport';
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
import './ResourceCalendar.css';

const PERIOD_WIDTH = 152;
const RESOURCE_WIDTH = 190;
const HEADER_HEIGHT = 58;
export default function ResourceCalendar<TResource, TItemData>({
  resources,
  data,
  getResourceId,
  getItemId,
  renderResource,
  buildItem,
  buildOverflowItem,
  isItemDraggable,
  canDropItem,
  onItemDrop,
  onCellClick,
  maxVisibleItemsPerCell = 1,
  renderOverflowSummary,
  periodDefinition = dayPeriodDefinition,
  ariaLabel = 'Resource calendar',
  resourceHeader = 'Resource',
  initialDate = new Date(),
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
  const [navigationAnchor, setNavigationAnchor] = useState(() => new Date(initialDate));
  const periodGroupSize = normalizePeriodGroupSize(periodDefinition.groupSize);
  const [measuredWidth, setMeasuredWidth] = useState<number | null>(null);
  const visiblePeriodCount = measuredWidth && measuredWidth > RESOURCE_WIDTH
    ? calculateVisiblePeriodCount(measuredWidth, RESOURCE_WIDTH, PERIOD_WIDTH)
    : initialVisiblePeriodCount;
  const calculatedInitialPeriodCount = calculateGroupedPeriodWindow(visiblePeriodCount, periodGroupSize);
  const effectivePeriodBuildSize = periodBuildSize ?? periodGroupSize;
  const { periods, viewportRef, goToDate } = usePeriodWindow({
    periodDefinition,
    initialDate,
    initialPeriodCount: calculatedInitialPeriodCount,
    periodBuildSize: effectivePeriodBuildSize,
    periodWidth: PERIOD_WIDTH,
    coveredLeftWidth: RESOURCE_WIDTH,
    onPeriodsBuilt,
    onInitialPeriods,
    initialLeadingPeriodCount: periodGroupSize,
    ready: measuredWidth !== null,
    onPeriodsReset,
  });
  const viewport = useCalendarViewport(viewportRef);
  useEffect(() => {
    if (viewport.initialWidth !== null) setMeasuredWidth(current => current ?? viewport.initialWidth);
  }, [viewport.initialWidth]);
  const visibleRows = useVirtualizedRows(resources, scrollTop, viewport.height, rowHeight, HEADER_HEIGHT, overscanRows);

  const gridColumns = `${RESOURCE_WIDTH}px repeat(${periods.length}, ${PERIOD_WIDTH}px)`;

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
          gridColumns={gridColumns}
          rowHeight={rowHeight}
          topSpacerHeight={visibleRows.first * rowHeight}
          bottomSpacerHeight={(resources.length - visibleRows.last) * rowHeight}
          resourceHeader={resourceHeader}
          getResourceId={getResourceId}
          getItemId={getItemId}
          renderResource={renderResource}
          buildItem={buildItem}
          buildOverflowItem={buildOverflowItem}
          isItemDraggable={isItemDraggable}
          onItemDropEnabled={!!onItemDrop}
          onCellClick={onCellClick}
          maxVisibleItemsPerCell={maxVisibleItemsPerCell}
          renderOverflowSummary={renderOverflowSummary}
          beginDrag={beginDrag}
          suppressClickRef={suppressClickRef}
          formatPeriodLabel={periodDefinition.formatLabel}
        />
      </div>
      {drag?.dragging && createPortal(
        <div
          ref={overlayRef}
          className="resource-calendar__drag-overlay"
          style={{ left: 0, top: 0, width: drag.width }}
          aria-hidden="true"
        >
          {buildItem(drag.context)}
        </div>,
        document.body,
      )}
    </div>
  );
}
