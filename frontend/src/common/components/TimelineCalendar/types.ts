import type { DateRange } from '../../utils/dateRange';
import type { CSSProperties, MutableRefObject, ReactNode, RefObject } from 'react';
import type { StartPointerSession } from './hooks/usePointerSession/usePointerSession';

// Periods and item ranges
export type PeriodKey = string;

export interface CalendarPeriod {
  key: PeriodKey;
  start: Date;
  end: Date;
}

export interface ItemRange {
  start: PeriodKey;
  end: PeriodKey;
}

// Item layout
export type ItemDensity = 'normal' | 'compact' | 'dense';
export type ResizeEdge = 'start' | 'end';

export interface ItemLayout {
  // Identity and original range
  id: string;
  rowId: string;
  start: string;
  end: string;

  // Visible placement
  style: CSSProperties;
  density: ItemDensity;
  hideSummary: boolean;
  startsInWindow: boolean;
  endsInWindow: boolean;
}

// Item interaction payloads and capabilities
export interface ItemResizeContext<TRow, TItemData> {
  // Original item
  row: TRow;
  item: TItemData;
  originalRange: ItemRange;

  // Resize result
  nextRange: ItemRange;
  edge: 'start' | 'end';
}

export interface ItemMoveContext<TRow, TItemData> {
  // Original item
  row: TRow;
  item: TItemData;
  originalRange: ItemRange;

  // Move result
  destinationRow: TRow;
  nextRange: ItemRange;
}

export interface ItemCapabilityContext<TRow, TItemData> {
  row: TRow;
  data: TItemData;
  range: ItemRange;
}

export type ItemActivateContext<TRow, TItemData> = ItemCapabilityContext<TRow, TItemData>;

export interface ItemCapabilities {
  draggable?: boolean;
  resizable?: boolean;
}

// Shared interaction configuration
export interface ItemInteractionState<TRow, TItemData> {
  // Current destination rows
  readonly rows: readonly TRow[];
  readonly getRowId: (row: TRow) => string;

  // Current interaction permissions
  readonly moveEnabled: boolean;
  readonly resizeEnabled: boolean;
  readonly canItemMove?: (context: ItemMoveContext<TRow, TItemData>) => boolean;
}

export type ItemStateRef<TRow, TItemData> = Readonly<MutableRefObject<ItemInteractionState<TRow, TItemData>>>;

export interface ItemCalendarProps<TRow = unknown, TItemData = unknown> {
  // Placement and source record
  layout: ItemLayout;
  target: ItemCapabilityContext<TRow, TItemData>;

  // Interaction configuration
  stateRef: ItemStateRef<TRow, TItemData>;
  movable: boolean;
  resizable: boolean;
  environment: ItemEnvironment;

  // Reported results
  onSelect: () => void;
  onActivate: () => void;
  onMove: (context: ItemMoveContext<TRow, TItemData>) => void;
  onResize: (context: ItemResizeContext<TRow, TItemData>) => void;
}

export interface ItemEnvironment {
  // Viewport geometry
  viewportRef: RefObject<HTMLElement | null>;
  getPeriods: () => readonly CalendarPeriod[];
  periodWidth: number;
  coveredLeftWidth: number;

  // Autoscroll
  dragEdgeSize: number;
  dragScrollSpeed: number;

  // Shared pointer coordination
  onPointerSessionRequest: StartPointerSession;
  onClickSuppressionRequest: () => void;
  isClickSuppressed: () => boolean;
}

// Period construction
export interface PeriodDefinition {
  navigate?: (anchor: Date, direction: 'previous' | 'next') => Date;
  buildInitial: (anchor: Date, count: number) => CalendarPeriod[];
  formatLabel: (period: CalendarPeriod) => string;
}

// Row data and rendering contexts
export type RowPeriodData<TItemData> = Record<string, Record<PeriodKey, readonly TItemData[]>>;
export type RowItemData<TItemData> = Record<string, readonly TItemData[] | undefined>;

export interface BuildItemContext<TRow, TItemData> {
  // Source record
  row: TRow;
  data: TItemData;
  range: ItemRange;

  // Visible placement and interactions
  visibleStart: CalendarPeriod;
  visibleEnd: CalendarPeriod;
  calendar: ItemCalendarProps<TRow, TItemData>;
}

export interface RenderRowContext<TRow> {
  row: TRow;
  index: number;
}

// Cell data and actions
export interface CalendarCellContext<TRow, TItemData> {
  row: TRow;
  rowIndex: number;
  period: CalendarPeriod;
  items: readonly TItemData[];
}

export interface CalendarCellAction {
  id: string;
  label: string;
  onSelect: () => void;
}

// Public calendar props
export interface TimelineCalendarProps<TRow, TItemData> {
  // Grid layout and accessibility
  ariaLabel?: string;
  rowHeight?: number;
  overscanRows?: number;

  // Periods and range loading
  periodDefinition?: PeriodDefinition;
  initialDate?: Date;
  positionStorageKey?: string;
  periodCount?: number;
  dateRange?: DateRange;
  overscanPeriods?: number;
  onInitialPeriods?: (periods: readonly CalendarPeriod[]) => void;
  onPeriodsBuilt?: (periods: readonly CalendarPeriod[], direction: 'left' | 'right') => void;
  onPeriodsReset?: (periods: readonly CalendarPeriod[]) => void;

  // Toolbar navigation
  showToolbar?: boolean;
  showTodayButton?: boolean;
  navigateDate?: (anchor: Date, direction: 'previous' | 'next') => Date;

  // Rows and selection
  rows: readonly TRow[];
  rowHeader?: ReactNode;
  getRowId: (row: TRow) => string;
  renderRow: (context: RenderRowContext<TRow>) => ReactNode;
  selectedRowId?: string | null;
  onRowSelect?: (row: TRow, source?: 'row' | 'item') => void;

  // Item data and rendering
  items: RowItemData<TItemData>;
  getItemId: (item: TItemData) => string;
  getItemRange: (item: TItemData) => ItemRange;
  buildItem: (context: BuildItemContext<TRow, TItemData>) => ReactNode;
  getItemCapabilities?: (context: ItemCapabilityContext<TRow, TItemData>) => ItemCapabilities;

  // Item interactions
  onItemActivate?: (context: ItemActivateContext<TRow, TItemData>) => void;
  canItemMove?: (context: ItemMoveContext<TRow, TItemData>) => boolean;
  onItemMove?: (context: ItemMoveContext<TRow, TItemData>) => void | Promise<void>;
  onItemResize?: (context: ItemResizeContext<TRow, TItemData>) => void | Promise<void>;
  dragEdgeSize?: number;
  dragScrollSpeed?: number;

  // Cell actions
  onCellActivate?: (context: CalendarCellContext<TRow, TItemData>) => void;
  getCellActions?: (context: CalendarCellContext<TRow, TItemData>) => readonly CalendarCellAction[];
}
