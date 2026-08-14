import { useState } from 'react';
import { createPortal } from 'react-dom';
import { useVirtualizedPeriods } from './periods/useVirtualizedPeriods';
import { useCalendarItemDrag } from './interactions/useCalendarItemDrag';
import { useCalendarRangeResize } from './interactions/useCalendarRangeResize';
import { useCalendarRangeMove } from './interactions/useCalendarRangeMove';
import { useVirtualizedResources } from './resources/useVirtualizedResources';
import { useCalendarInteractionCoordinator } from './interactions/useCalendarInteractionCoordinator';
import ResourceCalendarToolbar from './periods/ResourceCalendarToolbar';
import ResourceCalendarGrid from './resources/ResourceCalendarGrid';
import { dayPeriodDefinition } from './periods/periods';
import type { ResourceCalendarProps } from './types';
import { getCalendarPreviewHostStyle } from './items/rangePreview';
import { loadCalendarPosition } from './periods/calendarPosition';
import './ResourceCalendar.css';
import './items/CalendarItem.css';

const PERIOD_WIDTH = 145;
const RESOURCE_WIDTH = 125;
const HEADER_HEIGHT = 40;

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
}: ResourceCalendarProps<TResource, TItemData>) {
  const [initialPosition] = useState(() => loadCalendarPosition(positionStorageKey, initialDate));
  const [navigationAnchor, setNavigationAnchor] = useState(() => new Date(initialPosition.date));
  const effectiveOverscan = overscanPeriods ?? 14;
  const { periods, allPeriods, viewportRef, goToDate, visibleYear, firstPeriodIndex, leadingPeriodWidth, trailingPeriodWidth } = useVirtualizedPeriods({
    periodDefinition,
    initialDate: initialPosition.date,
    initialOffset: initialPosition.offset,
    positionStorageKey,
    periodCount,
    overscan: effectiveOverscan,
    periodWidth: PERIOD_WIDTH,
    coveredLeftWidth: RESOURCE_WIDTH,
    onPeriodsBuilt,
    onInitialPeriods,
    onPeriodsReset,
  });
  const visibleRows = useVirtualizedResources(
    resources,
    viewportRef,
    rowHeight,
    HEADER_HEIGHT,
    overscanRows,
  );

  const gridColumns = `${RESOURCE_WIDTH}px ${leadingPeriodWidth}px repeat(${periods.length}, ${PERIOD_WIDTH}px) ${trailingPeriodWidth}px`;
  const [today] = useState(() => new Date());
  const interactionCoordinator = useCalendarInteractionCoordinator();

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
    interactionCoordinator,
  });
  const { beginResize, resizeByKeyboard, suppressClickRef: suppressResizeClickRef } = useCalendarRangeResize({
    viewportRef, periods, periodWidth: PERIOD_WIDTH, coveredLeftWidth: RESOURCE_WIDTH, onRangeResize,
    firstPeriodIndex,
    dragEdgeSize, dragScrollSpeed,
    interactionCoordinator,
  });
  const { beginRangeMove, suppressRangeMoveClickRef } = useCalendarRangeMove({
    viewportRef, periods: allPeriods, periodWidth: PERIOD_WIDTH, resources, getResourceId, canRangeMove, onRangeMove,
    dragEdgeSize, dragScrollSpeed, coveredLeftWidth: RESOURCE_WIDTH,
    interactionCoordinator,
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
          year={visibleYear}
          onToday={showTodayButton ? goToToday : undefined}
          onPrevious={navigationHandler ? () => navigate('previous') : undefined}
          onNext={navigationHandler ? () => navigate('next') : undefined}
        />
      )}
      <div
        ref={viewportRef}
        className="resource-calendar"
        role="grid"
        aria-label={ariaLabel}
      >
        <ResourceCalendarGrid
          resources={visibleRows.resources}
          firstResourceIndex={visibleRows.first}
          periods={periods}
          leadingPeriodWidth={leadingPeriodWidth}
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
