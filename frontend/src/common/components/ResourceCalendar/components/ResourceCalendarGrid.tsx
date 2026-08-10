import { memo, type MutableRefObject, type ReactNode } from 'react';
import ResourceCalendarRow from './ResourceCalendarRow';
import type { CalendarPointerDrag } from '../hooks/useCalendarItemDrag';
import type {
  BuildItemContext,
  CalendarCellContext,
  CalendarPeriod,
  CellOverflowContext,
  OverflowItemActions,
  ResourcePeriodData,
} from '../types';

interface ResourceCalendarGridProps<TResource, TItemData> {
  resources: readonly TResource[];
  firstResourceIndex: number;
  periods: readonly CalendarPeriod[];
  data: ResourcePeriodData<TItemData>;
  gridColumns: string;
  rowHeight: number;
  topSpacerHeight: number;
  bottomSpacerHeight: number;
  resourceHeader: ReactNode;
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
  formatPeriodLabel: (period: CalendarPeriod) => string;
}

const EMPTY_RESOURCE_DATA: Record<string, readonly unknown[]> = {};

function ResourceCalendarGrid<TResource, TItemData>({
  resources,
  firstResourceIndex,
  periods,
  data,
  gridColumns,
  rowHeight,
  topSpacerHeight,
  bottomSpacerHeight,
  resourceHeader,
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
  formatPeriodLabel,
}: ResourceCalendarGridProps<TResource, TItemData>) {
  return (
    <>
      <div className="resource-calendar__header" style={{ gridTemplateColumns: gridColumns }}>
        <div className="resource-calendar__corner">{resourceHeader}</div>
        {periods.map((period, index) => (
          <div
            key={period.key}
            className="resource-calendar__period"
            data-edge={index === 0 ? 'left' : index === periods.length - 1 ? 'right' : undefined}
          >
            <span>{formatPeriodLabel(period)}</span>
          </div>
        ))}
      </div>

      <div style={{ height: topSpacerHeight }} aria-hidden="true" />
      {resources.map((resource, visibleIndex) => (
        <ResourceCalendarRow
          key={getResourceId(resource)}
          resource={resource}
          resourceIndex={firstResourceIndex + visibleIndex}
          resourceData={data[getResourceId(resource)] ?? EMPTY_RESOURCE_DATA as Record<string, readonly TItemData[]>}
          periods={periods}
          gridColumns={gridColumns}
          rowHeight={rowHeight}
          getResourceId={getResourceId}
          getItemId={getItemId}
          renderResource={renderResource}
          buildItem={buildItem}
          buildOverflowItem={buildOverflowItem}
          isItemDraggable={isItemDraggable}
          onItemDropEnabled={onItemDropEnabled}
          onCellClick={onCellClick}
          maxVisibleItemsPerCell={maxVisibleItemsPerCell}
          renderOverflowSummary={renderOverflowSummary}
          beginDrag={beginDrag}
          suppressClickRef={suppressClickRef}
        />
      ))}
      <div style={{ height: bottomSpacerHeight }} aria-hidden="true" />
    </>
  );
}

export default memo(ResourceCalendarGrid) as typeof ResourceCalendarGrid;
