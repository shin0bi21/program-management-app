import type { DateRange } from '../../utils/dateRange';
import type { ReactNode } from 'react';

export type PeriodKey = string;

export interface CalendarPeriod {
  key: PeriodKey;
  start: Date;
  end: Date;
}

export interface PeriodDefinition {
  navigate?: (anchor: Date, direction: 'previous' | 'next') => Date;
  buildInitial: (anchor: Date, count: number) => CalendarPeriod[];
  formatLabel: (period: CalendarPeriod) => string;
}

export type RowPeriodData<TItemData> = Record<string, Record<PeriodKey, readonly TItemData[]>>;
export type RowItemData<TItemData> = Record<string, readonly TItemData[] | undefined>;

export interface ItemRange { start: PeriodKey; end: PeriodKey }

export interface BuildItemContext<TRow, TItemData> {
  row: TRow;
  data: TItemData;
  range: ItemRange;
  visibleStart: CalendarPeriod;
  visibleEnd: CalendarPeriod;
}

export interface ItemResizeContext<TRow, TItemData> {
  row: TRow;
  item: TItemData;
  originalRange: ItemRange;
  nextRange: ItemRange;
  edge: 'start' | 'end';
}
export interface ItemMoveContext<TRow, TItemData> {
  row: TRow;
  destinationRow: TRow;
  item: TItemData;
  originalRange: ItemRange;
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

export interface RenderRowContext<TRow> {
  row: TRow;
  index: number;
}

export interface CalendarCellContext<TRow, TItemData> {
  row: TRow;
  rowIndex: number;
  period: CalendarPeriod;
  items: readonly TItemData[];
}
export interface CalendarCellAction { id: string; label: string; onSelect: () => void }

export interface TimelineCalendarProps<TRow, TItemData> {
  rows: readonly TRow[];
  items: RowItemData<TItemData>;
  getItemRange: (item: TItemData) => ItemRange;
  getRowId: (row: TRow) => string;
  getItemId: (item: TItemData) => string;
  renderRow: (context: RenderRowContext<TRow>) => ReactNode;
  selectedRowId?: string | null;
  onRowSelect?: (row: TRow) => void;
  buildItem: (context: BuildItemContext<TRow, TItemData>) => ReactNode;
  getItemCapabilities?: (context: ItemCapabilityContext<TRow, TItemData>) => ItemCapabilities;
  onItemActivate?: (context: ItemActivateContext<TRow, TItemData>) => void;
  onItemResize?: (context: ItemResizeContext<TRow, TItemData>) => void | Promise<void>;
  onItemMove?: (context: ItemMoveContext<TRow, TItemData>) => void | Promise<void>;
  canItemMove?: (context: ItemMoveContext<TRow, TItemData>) => boolean;
  onCellActivate?: (context: CalendarCellContext<TRow, TItemData>) => void;
  getCellActions?: (context: CalendarCellContext<TRow, TItemData>) => readonly CalendarCellAction[];
  periodDefinition?: PeriodDefinition;
  ariaLabel?: string;
  rowHeader?: ReactNode;
  initialDate?: Date;
  positionStorageKey?: string;
  periodCount?: number;
  dateRange?: DateRange;
  overscanPeriods?: number;
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
