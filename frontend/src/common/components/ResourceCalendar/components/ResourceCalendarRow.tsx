import { memo, type MutableRefObject, type ReactNode } from 'react';
import ResourceCalendarCell from './ResourceCalendarCell';
import type { CalendarPointerDrag } from '../hooks/useCalendarItemDrag';
import type {
  BuildItemContext,
  CalendarCellContext,
  CalendarPeriod,
  CellOverflowContext,
  OverflowItemActions,
} from '../types';

interface ResourceCalendarRowProps<TResource, TItemData> {
  resource: TResource;
  resourceIndex: number;
  resourceData: Record<string, readonly TItemData[]>;
  periods: readonly CalendarPeriod[];
  gridColumns: string;
  rowHeight: number;
  getResourceId: (resource: TResource) => string;
  getItemId: (item: TItemData) => string;
  renderResource: (context: { resource: TResource; index: number }) => ReactNode;
  buildItem: (context: BuildItemContext<TResource, TItemData>) => ReactNode;
  buildOverflowItem?: (context: BuildItemContext<TResource, TItemData>, actions: OverflowItemActions) => ReactNode;
  isItemDraggable?: (context: BuildItemContext<TResource, TItemData>) => boolean;
  onItemDropEnabled: boolean;
  onCellClick?: (context: CalendarCellContext<TResource, TItemData>) => void;
  maxVisibleItemsPerCell: number;
  renderOverflowSummary?: (context: CellOverflowContext<TResource, TItemData>) => ReactNode;
  beginDrag: (drag: CalendarPointerDrag<TResource, TItemData>) => void;
  suppressClickRef: MutableRefObject<boolean>;
}

function ResourceCalendarRow<TResource, TItemData>({
  resource,
  resourceIndex,
  resourceData,
  periods,
  gridColumns,
  rowHeight,
  getResourceId,
  getItemId,
  renderResource,
  buildItem,
  buildOverflowItem,
  isItemDraggable,
  onItemDropEnabled,
  onCellClick,
  maxVisibleItemsPerCell,
  renderOverflowSummary,
  beginDrag,
  suppressClickRef,
}: ResourceCalendarRowProps<TResource, TItemData>) {
  const resourceId = getResourceId(resource);
  return (
    <div className="resource-calendar__row" style={{ gridTemplateColumns: gridColumns, height: rowHeight }}>
      <div className="resource-calendar__resource">{renderResource({ resource, index: resourceIndex })}</div>
      {periods.map(period => {
        const items = resourceData[period.key] ?? [];
        const renderItem = (item: TItemData, onEnd?: () => void, closeOverflow?: () => void) => {
          const itemContext = { resource, period, data: item };
          const draggable = onItemDropEnabled && (isItemDraggable?.(itemContext) ?? true);
          return (
            <div
              className={`resource-calendar__item${draggable ? ' resource-calendar__item--draggable' : ''}`}
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
                if (!suppressClickRef.current) return;
                event.preventDefault();
                event.stopPropagation();
              }}
            >
              {closeOverflow && buildOverflowItem
                ? buildOverflowItem(itemContext, { close: closeOverflow })
                : buildItem(itemContext)}
            </div>
          );
        };
        return (
          <ResourceCalendarCell
            key={period.key}
            context={{ resource, resourceIndex, period, items }}
            resourceId={resourceId}
            getItemId={getItemId}
            renderItem={renderItem}
            renderOverflowItem={(item, onEnd, closeOverflow) => renderItem(item, onEnd, closeOverflow)}
            onCellClick={onCellClick}
            maxVisibleItems={Math.max(0, Math.floor(maxVisibleItemsPerCell))}
            renderOverflowSummary={renderOverflowSummary}
          />
        );
      })}
    </div>
  );
}

export default memo(ResourceCalendarRow) as typeof ResourceCalendarRow;
