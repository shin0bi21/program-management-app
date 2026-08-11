import type { ReactNode } from 'react';

export type PeriodKey = string;

export interface CalendarPeriod {
  key: PeriodKey;
  start: Date;
  end: Date;
}

export interface PeriodDefinition {
  groupSize?: number;
  navigate?: (anchor: Date, direction: 'previous' | 'next') => Date;
  buildInitial: (anchor: Date, count: number) => CalendarPeriod[];
  shiftWindow: (
    periods: readonly CalendarPeriod[],
    direction: 'left' | 'right',
    buildCount: number,
    windowSize: number,
  ) => { periods: CalendarPeriod[]; built: CalendarPeriod[] };
  formatLabel: (period: CalendarPeriod) => string;
}

export type ResourcePeriodData<TItemData> = Record<string, Record<PeriodKey, readonly TItemData[]>>;
export type ResourceRangeData<TItemData> = Record<string, readonly TItemData[]>;

export interface ItemRange { start: PeriodKey; end: PeriodKey }

export interface BuildRangeItemContext<TResource, TItemData> {
  resource: TResource;
  data: TItemData;
  range: ItemRange;
  visibleStart: CalendarPeriod;
  visibleEnd: CalendarPeriod;
}

export interface RangeResizeContext<TResource, TItemData> {
  resource: TResource;
  item: TItemData;
  originalRange: ItemRange;
  nextRange: ItemRange;
  edge: 'start' | 'end';
}
export interface RangeMoveContext<TResource, TItemData> {
  resource: TResource;
  destinationResource: TResource;
  item: TItemData;
  originalRange: ItemRange;
  nextRange: ItemRange;
}

export interface ItemCapabilityContext<TResource, TItemData> {
  resource: TResource;
  data: TItemData;
  period?: CalendarPeriod;
  range?: ItemRange;
}
export type ItemActivateContext<TResource, TItemData> = ItemCapabilityContext<TResource, TItemData>;

export interface CalendarItemCapabilities {
  draggable?: boolean;
  resizable?: boolean;
}

export interface BuildItemContext<TResource, TItemData> {
  resource: TResource;
  period: CalendarPeriod;
  data: TItemData;
}

export interface OverflowItemActions {
  close: () => void;
}

export type ItemDragContext<TResource, TItemData> = BuildItemContext<TResource, TItemData>;

export interface ItemDropContext<TResource, TItemData> {
  item: TItemData;
  source: { resource: TResource; period: CalendarPeriod };
  destination: { resource: TResource; period: CalendarPeriod };
}

export interface RenderResourceContext<TResource> {
  resource: TResource;
  index: number;
}

export interface CalendarCellContext<TResource, TItemData> {
  resource: TResource;
  resourceIndex: number;
  period: CalendarPeriod;
  items: readonly TItemData[];
}
export interface CalendarCellAction { id: string; label: string; onSelect: () => void }

export interface CellOverflowContext<TResource, TItemData> extends CalendarCellContext<TResource, TItemData> {
  itemCount: number;
}

export interface ResourceCalendarProps<TResource, TItemData> {
  resources: readonly TResource[];
  data: ResourcePeriodData<TItemData>;
  rangeData?: ResourceRangeData<TItemData>;
  getItemRange?: (item: TItemData) => ItemRange;
  getResourceId: (resource: TResource) => string;
  getItemId: (item: TItemData) => string;
  renderResource: (context: RenderResourceContext<TResource>) => ReactNode;
  selectedResourceId?: string | null;
  onResourceSelect?: (resource: TResource) => void;
  buildItem: (context: BuildItemContext<TResource, TItemData>) => ReactNode;
  buildRangeItem?: (context: BuildRangeItemContext<TResource, TItemData>) => ReactNode;
  getItemCapabilities?: (context: ItemCapabilityContext<TResource, TItemData>) => CalendarItemCapabilities;
  onItemActivate?: (context: ItemActivateContext<TResource, TItemData>) => void;
  onRangeResize?: (context: RangeResizeContext<TResource, TItemData>) => void | Promise<void>;
  onRangeMove?: (context: RangeMoveContext<TResource, TItemData>) => void | Promise<void>;
  canRangeMove?: (context: RangeMoveContext<TResource, TItemData>) => boolean;
  buildOverflowItem?: (
    context: BuildItemContext<TResource, TItemData>,
    actions: OverflowItemActions,
  ) => ReactNode;
  canDropItem?: (context: ItemDropContext<TResource, TItemData>) => boolean;
  onItemDrop?: (context: ItemDropContext<TResource, TItemData>) => void | Promise<void>;
  onCellActivate?: (context: CalendarCellContext<TResource, TItemData>) => void;
  getCellActions?: (context: CalendarCellContext<TResource, TItemData>) => readonly CalendarCellAction[];
  maxVisibleItemsPerCell?: number;
  renderOverflowSummary?: (context: CellOverflowContext<TResource, TItemData>) => ReactNode;
  periodDefinition?: PeriodDefinition;
  ariaLabel?: string;
  resourceHeader?: ReactNode;
  initialDate?: Date;
  positionStorageKey?: string;
  initialVisiblePeriodCount?: number;
  periodBuildSize?: number;
  rowHeight?: number;
  overscanRows?: number;
  onPeriodsBuilt?: (periods: readonly CalendarPeriod[], direction: 'left' | 'right') => void;
  onInitialPeriods?: (periods: readonly CalendarPeriod[]) => void;
  onPeriodsReset?: (periods: readonly CalendarPeriod[]) => void;
  showToolbar?: boolean;
  showTodayButton?: boolean;
  navigateDate?: (anchor: Date, direction: 'previous' | 'next') => Date;
  dragEdgeSize?: number;
  dragScrollSpeed?: number;
}
