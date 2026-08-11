import { memo, type MutableRefObject, type ReactNode } from 'react';
import ResourceCalendarCell from './ResourceCalendarCell';
import type { CalendarPointerDrag } from '../hooks/useCalendarItemDrag';
import type { CalendarRangeResize } from '../hooks/useCalendarRangeResize';
import type { CalendarRangeMove } from '../hooks/useCalendarRangeMove';
import type {
  BuildItemContext,
  BuildRangeItemContext,
  CalendarCellContext,
  CalendarCellAction,
  CalendarPeriod,
  CellOverflowContext,
  OverflowItemActions,
  ItemRange,
  ItemCapabilityContext,
  CalendarItemCapabilities,
  ItemActivateContext,
} from '../types';
import {
  getCalendarItemDensity,
  layoutRangeItems,
  type CalendarItemDensity,
} from '../utils/rangeLayout';

const MAX_READABLE_ITEMS_PER_CELL = 7;

function getRangeItemGeometry(density: CalendarItemDensity, lane: number, laneCount: number, rowHeight: number) {
  const padding = density === 'dense' ? 4 : density === 'compact' ? 7 : 8;
  const gap = density === 'dense' ? 2 : density === 'compact' ? 3 : 8;
  const height = density === 'normal'
    ? 26
    : (rowHeight - (padding * 2) - (gap * (laneCount - 1))) / laneCount;
  return { top: padding + (lane * (height + gap)), height };
}

interface ResourceCalendarRowProps<TResource, TItemData> {
  resource: TResource;
  resourceIndex: number;
  resourceData: Record<string, readonly TItemData[]>;
  rangeItems: readonly TItemData[];
  getItemRange?: (item: TItemData) => ItemRange;
  periods: readonly CalendarPeriod[];
  gridColumns: string;
  rowHeight: number;
  getResourceId: (resource: TResource) => string;
  getItemId: (item: TItemData) => string;
  renderResource: (context: { resource: TResource; index: number }) => ReactNode;
  selected: boolean;
  onResourceSelect?: (resource: TResource) => void;
  buildItem: (context: BuildItemContext<TResource, TItemData>) => ReactNode;
  buildRangeItem?: (context: BuildRangeItemContext<TResource, TItemData>) => ReactNode;
  getItemCapabilities?: (context: ItemCapabilityContext<TResource, TItemData>) => CalendarItemCapabilities;
  onItemActivate?: (context: ItemActivateContext<TResource, TItemData>) => void;
  rangeResizeEnabled: boolean;
  beginResize: (resize: CalendarRangeResize<TResource, TItemData>) => void;
  resizeByKeyboard: (resize: Omit<CalendarRangeResize<TResource, TItemData>, 'pointerId' | 'startX' | 'sourceElement' | 'rangeElement' | 'nextIndex' | 'resizing'>, direction: -1 | 1) => void;
  suppressResizeClickRef: MutableRefObject<boolean>;
  rangeMoveEnabled: boolean;
  beginRangeMove: (move: CalendarRangeMove<TResource, TItemData>) => void;
  suppressRangeMoveClickRef: MutableRefObject<boolean>;
  buildOverflowItem?: (context: BuildItemContext<TResource, TItemData>, actions: OverflowItemActions) => ReactNode;
  onItemDropEnabled: boolean;
  onCellClick?: (context: CalendarCellContext<TResource, TItemData>) => void;
  getCellActions?: (context: CalendarCellContext<TResource, TItemData>) => readonly CalendarCellAction[];
  maxVisibleItemsPerCell: number;
  renderOverflowSummary?: (context: CellOverflowContext<TResource, TItemData>) => ReactNode;
  beginDrag: (drag: CalendarPointerDrag<TResource, TItemData>) => void;
  suppressClickRef: MutableRefObject<boolean>;
  today: Date;
}

function ResourceCalendarRow<TResource, TItemData>({
  resource,
  resourceIndex,
  resourceData,
  rangeItems,
  getItemRange,
  periods,
  gridColumns,
  rowHeight,
  getResourceId,
  getItemId,
  renderResource,
  selected,
  onResourceSelect,
  buildItem,
  buildRangeItem,
  getItemCapabilities,
  onItemActivate,
  rangeResizeEnabled,
  beginResize,
  resizeByKeyboard,
  suppressResizeClickRef,
  rangeMoveEnabled,
  beginRangeMove,
  suppressRangeMoveClickRef,
  buildOverflowItem,
  onItemDropEnabled,
  onCellClick,
  getCellActions,
  maxVisibleItemsPerCell,
  renderOverflowSummary,
  beginDrag,
  suppressClickRef,
  today,
}: ResourceCalendarRowProps<TResource, TItemData>) {
  const resourceId = getResourceId(resource);
  const normalizedMaxVisibleItems = Math.min(
    MAX_READABLE_ITEMS_PER_CELL,
    Math.max(0, Math.floor(maxVisibleItemsPerCell)),
  );
  const selectResource = () => {
    if (!selected) onResourceSelect?.(resource);
  };
  const positionedRanges = getItemRange && buildRangeItem
    ? layoutRangeItems(rangeItems, periods, getItemRange)
    : [];
  const renderItem = (
    period: CalendarPeriod,
    item: TItemData,
    onEnd?: () => void,
    closeOverflow?: () => void,
  ) => {
    const itemContext = { resource, period, data: item };
    const draggable = onItemDropEnabled && (getItemCapabilities?.(itemContext).draggable ?? true);
    return (
      <div
        className={`resource-calendar__item${draggable ? ' draggable' : ''}`}
        onPointerDown={draggable ? event => {
          if (event.button !== 0) return;
          const bounds = event.currentTarget.getBoundingClientRect();
          beginDrag({
            pointerId: event.pointerId,
            startX: event.clientX,
            startY: event.clientY,
            x: event.clientX,
            y: event.clientY,
            width: bounds.width,
            sourceElement: event.currentTarget,
            context: itemContext,
            dragging: false,
            onEnd,
          });
        } : undefined}
        onClickCapture={event => {
          if (suppressClickRef.current) {
            event.preventDefault();
            event.stopPropagation();
            return;
          }
          selectResource();
        }}
        onClick={() => onItemActivate?.(itemContext)}
      >
        {closeOverflow && buildOverflowItem
          ? buildOverflowItem(itemContext, { close: closeOverflow })
          : buildItem(itemContext)}
      </div>
    );
  };

  return (
    <div
      className={`resource-calendar__row${selected ? ' resource-calendar__row--selected' : ''}`}
      data-resource-id={resourceId}
      style={{ gridTemplateColumns: gridColumns, height: rowHeight }}
    >
      <div className="resource-calendar__resource">
        {onResourceSelect ? (
          <button
            type="button"
            className="resource-calendar__resource-select"
            aria-pressed={selected}
            onClick={selectResource}
          >
            {renderResource({ resource, index: resourceIndex })}
          </button>
        ) : renderResource({ resource, index: resourceIndex })}
      </div>
      {periods.map(period => {
        const items = resourceData[period.key] ?? [];
        return (
          <ResourceCalendarCell
            key={period.key}
            className={today >= period.start && today < period.end ? 'resource-calendar__cell--today' : undefined}
            context={{ resource, resourceIndex, period, items }}
            resourceId={resourceId}
            getItemId={getItemId}
            renderOverflowItem={(item, onEnd, closeOverflow) => renderItem(period, item, onEnd, closeOverflow)}
            onCellClick={onCellClick}
            getCellActions={getCellActions}
            maxVisibleItems={normalizedMaxVisibleItems}
            renderOverflowSummary={renderOverflowSummary}
          />
        );
      })}
      <div
        className="resource-calendar__item-layer"
        style={{ gridTemplateColumns: gridColumns }}
      >
        <div aria-hidden="true" />
        {periods.map(period => {
          const items = resourceData[period.key] ?? [];
          const visibleItems = items.length > normalizedMaxVisibleItems ? [] : items;
          const density = getCalendarItemDensity(visibleItems.length);
          return (
            <div
              key={period.key}
              className={`resource-calendar__item-slot resource-calendar__item-slot--${density}`}
              data-item-count={visibleItems.length}
              data-item-period={period.key}
              data-item-resource-id={resourceId}
            >
              {visibleItems.map(item => (
                <div key={getItemId(item)}>{renderItem(period, item)}</div>
              ))}
            </div>
          );
        })}
      </div>
      {positionedRanges.length > 0 && (
        <div className="resource-calendar__range-layer" style={{ gridTemplateColumns: gridColumns }}>
          {positionedRanges.map(({ item, range, startIndex, endIndex, lane, laneCount }) => {
            const capabilities = getItemCapabilities?.({ resource, data: item, range });
            const movable = rangeMoveEnabled && (capabilities?.draggable ?? false)
              && range.start === periods[startIndex].key && range.end === periods[endIndex].key;
            const resizable = rangeResizeEnabled && (capabilities?.resizable ?? false);
            const density = getCalendarItemDensity(laneCount);
            const geometry = getRangeItemGeometry(density, lane, laneCount, rowHeight);
            const context = { resource, data: item, range, visibleStart: periods[startIndex], visibleEnd: periods[endIndex] };
            return (
            <div
              key={getItemId(item)}
              className={`resource-calendar__item resource-calendar__range-item resource-calendar__range-item--${density}${movable ? ' draggable' : ''}${resizable ? ' resizable' : ''}`}
              data-range-density={density}
              style={{ gridColumn: `${startIndex + 2} / ${endIndex + 3}`, gridRow: 1, top: geometry.top, height: geometry.height }}
              onPointerDown={movable ? event => {
                if (event.button !== 0) return;
                beginRangeMove({ pointerId: event.pointerId, startX: event.clientX, startY: event.clientY, sourceElement: event.currentTarget, resource, item, range, startIndex, endIndex, delta: 0, moving: false });
              } : undefined}
              onClickCapture={event => {
                if (suppressResizeClickRef.current || suppressRangeMoveClickRef.current) {
                  event.preventDefault();
                  event.stopPropagation();
                  return;
                }
                selectResource();
              }}
              onClick={() => onItemActivate?.({ resource, data: item, range })}
            >
              {resizable && range.start === periods[startIndex].key && <button type="button" className="resource-calendar__range-handle resource-calendar__range-handle--start" aria-label={`Resize start of ${getItemId(item)}`} onClick={event => event.stopPropagation()} onKeyDown={event => { if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') { event.preventDefault(); resizeByKeyboard({ resource, item, range, edge: 'start', startIndex, endIndex }, event.key === 'ArrowLeft' ? -1 : 1); } }} onPointerDown={event => { event.stopPropagation(); if (event.button !== 0) return; beginResize({ pointerId: event.pointerId, startX: event.clientX, sourceElement: event.currentTarget, rangeElement: event.currentTarget.parentElement!, resource, item, range, edge: 'start', startIndex, endIndex, nextIndex: startIndex, resizing: false }); }} />}
              {buildRangeItem?.(context)}
              {resizable && range.end === periods[endIndex].key && <button type="button" className="resource-calendar__range-handle resource-calendar__range-handle--end" aria-label={`Resize end of ${getItemId(item)}`} onClick={event => event.stopPropagation()} onKeyDown={event => { if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') { event.preventDefault(); resizeByKeyboard({ resource, item, range, edge: 'end', startIndex, endIndex }, event.key === 'ArrowLeft' ? -1 : 1); } }} onPointerDown={event => { event.stopPropagation(); if (event.button !== 0) return; beginResize({ pointerId: event.pointerId, startX: event.clientX, sourceElement: event.currentTarget, rangeElement: event.currentTarget.parentElement!, resource, item, range, edge: 'end', startIndex, endIndex, nextIndex: endIndex, resizing: false }); }} />}
            </div>
          );})}
        </div>
      )}
    </div>
  );
}

export default memo(ResourceCalendarRow) as typeof ResourceCalendarRow;
