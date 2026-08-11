import { memo, type MutableRefObject, type ReactNode } from 'react';
import ResourceCalendarRow from './ResourceCalendarRow';
import type { CalendarPointerDrag } from '../hooks/useCalendarItemDrag';
import type { CalendarRangeResize } from '../hooks/useCalendarRangeResize';
import type { CalendarRangeMove } from '../hooks/useCalendarRangeMove';
import type {
  BuildItemContext,
  CalendarCellContext,
  CalendarCellAction,
  CalendarPeriod,
  CellOverflowContext,
  BuildRangeItemContext,
  ItemRange,
  ItemCapabilityContext,
  CalendarItemCapabilities,
  ItemActivateContext,
  OverflowItemActions,
  ResourceRangeData,
  ResourcePeriodData,
} from '../types';

interface ResourceCalendarGridProps<TResource, TItemData> {
  resources: readonly TResource[];
  firstResourceIndex: number;
  periods: readonly CalendarPeriod[];
  data: ResourcePeriodData<TItemData>;
  rangeData?: ResourceRangeData<TItemData>;
  getItemRange?: (item: TItemData) => ItemRange;
  gridColumns: string;
  rowHeight: number;
  topSpacerHeight: number;
  bottomSpacerHeight: number;
  resourceHeader: ReactNode;
  getResourceId: (resource: TResource) => string;
  getItemId: (item: TItemData) => string;
  renderResource: (context: { resource: TResource; index: number }) => ReactNode;
  selectedResourceId?: string | null;
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
  formatPeriodLabel: (period: CalendarPeriod) => string;
  today: Date;
}

const EMPTY_RESOURCE_DATA: Record<string, readonly unknown[]> = {};

function ResourceCalendarGrid<TResource, TItemData>({
  resources,
  firstResourceIndex,
  periods,
  data,
  rangeData,
  getItemRange,
  gridColumns,
  rowHeight,
  topSpacerHeight,
  bottomSpacerHeight,
  resourceHeader,
  getResourceId,
  getItemId,
  renderResource,
  selectedResourceId,
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
  formatPeriodLabel,
  today,
}: ResourceCalendarGridProps<TResource, TItemData>) {
  return (
    <>
      <div className="resource-calendar__header" style={{ gridTemplateColumns: gridColumns }}>
        <div className="resource-calendar__corner">{resourceHeader}</div>
        {periods.map((period, index) => (
          <div
            key={period.key}
            className={`resource-calendar__period${today >= period.start && today < period.end ? ' resource-calendar__period--today' : ''}`}
            data-edge={index === 0 ? 'left' : index === periods.length - 1 ? 'right' : undefined}
            data-period-key={period.key}
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
          rangeItems={rangeData?.[getResourceId(resource)] ?? []}
          getItemRange={getItemRange}
          periods={periods}
          gridColumns={gridColumns}
          rowHeight={rowHeight}
          getResourceId={getResourceId}
          getItemId={getItemId}
          renderResource={renderResource}
          selected={selectedResourceId === getResourceId(resource)}
          onResourceSelect={onResourceSelect}
          buildItem={buildItem}
          buildRangeItem={buildRangeItem}
          getItemCapabilities={getItemCapabilities}
          onItemActivate={onItemActivate}
          rangeResizeEnabled={rangeResizeEnabled}
          beginResize={beginResize}
          resizeByKeyboard={resizeByKeyboard}
          suppressResizeClickRef={suppressResizeClickRef}
          rangeMoveEnabled={rangeMoveEnabled}
          beginRangeMove={beginRangeMove}
          suppressRangeMoveClickRef={suppressRangeMoveClickRef}
          buildOverflowItem={buildOverflowItem}
          onItemDropEnabled={onItemDropEnabled}
          onCellClick={onCellClick}
          getCellActions={getCellActions}
          maxVisibleItemsPerCell={maxVisibleItemsPerCell}
          renderOverflowSummary={renderOverflowSummary}
          beginDrag={beginDrag}
          suppressClickRef={suppressClickRef}
          today={today}
        />
      ))}
      <div style={{ height: bottomSpacerHeight }} aria-hidden="true" />
    </>
  );
}

export default memo(ResourceCalendarGrid) as typeof ResourceCalendarGrid;
