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

export interface CellOverflowContext<TResource, TItemData> extends CalendarCellContext<TResource, TItemData> {
  itemCount: number;
}

export interface ResourceCalendarProps<TResource, TItemData> {
  resources: readonly TResource[];
  data: ResourcePeriodData<TItemData>;
  getResourceId: (resource: TResource) => string;
  getItemId: (item: TItemData) => string;
  renderResource: (context: RenderResourceContext<TResource>) => ReactNode;
  buildItem: (context: BuildItemContext<TResource, TItemData>) => ReactNode;
  buildOverflowItem?: (
    context: BuildItemContext<TResource, TItemData>,
    actions: OverflowItemActions,
  ) => ReactNode;
  isItemDraggable?: (context: ItemDragContext<TResource, TItemData>) => boolean;
  canDropItem?: (context: ItemDropContext<TResource, TItemData>) => boolean;
  onItemDrop?: (context: ItemDropContext<TResource, TItemData>) => void | Promise<void>;
  onCellClick?: (context: CalendarCellContext<TResource, TItemData>) => void;
  maxVisibleItemsPerCell?: number;
  renderOverflowSummary?: (context: CellOverflowContext<TResource, TItemData>) => ReactNode;
  periodDefinition?: PeriodDefinition;
  ariaLabel?: string;
  resourceHeader?: ReactNode;
  initialDate?: Date;
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
