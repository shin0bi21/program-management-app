import type { DateRange } from '../../utils/dateRange';
import type { CSSProperties, MutableRefObject, ReactNode, RefObject } from 'react';
import type { StartPointerSession } from './hooks/usePointerSession/usePointerSession';

// Periods and item ranges
/** Chronologically sortable key shared by periods and item ranges, e.g. '2026-08-19'. */
export type PeriodKey = string;

/** One column's half-open date interval: start is included, end is excluded. */
export interface CalendarPeriod {
  key: PeriodKey;
  start: string;
  /** Exclusive date boundary; item range keys below instead have inclusive ends. */
  end: string;
}

/** Ordered inclusive period keys: a one-period item has identical start and end keys. */
export interface ItemRange {
  start: PeriodKey;
  end: PeriodKey;
}

/** Buffered membership and inclusive placement; the feature owner holds the full record. */
export interface CalendarItemReference extends ItemRange { id: string }

// Item layout
export type ItemDensity = 'normal' | 'compact' | 'dense';
export type ResizeEdge = 'start' | 'end';

/** Original item endpoints plus placement clipped to the rendered period window. */
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

/**
 * Per-item opt-ins, disabled when omitted; the corresponding save callback must also exist.
 * Moving additionally requires both endpoints in the rendered window; resizing exposes only visible endpoints.
 */
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

/** Calendar-owned committed state read at completion, even if the initiating Item has unmounted. */
export type ItemStateRef<TRow, TItemData> = Readonly<MutableRefObject<ItemInteractionState<TRow, TItemData>>>;

/** Placement and bound interaction callbacks forwarded unchanged from buildItem to the shared Item shell. */
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
  /** Complete chronological period window, including columns outside the rendered slice. */
  getPeriods: () => readonly CalendarPeriod[];
  /** Column width in CSS pixels. */
  periodWidth: number;
  /** Sticky row-header width in CSS pixels, excluded from timeline hit testing. */
  coveredLeftWidth: number;

  // Autoscroll
  /** Edge-zone depth in CSS pixels; must be positive. */
  dragEdgeSize: number;
  /** Maximum CSS pixels scrolled per animation frame; must be at least 2. */
  dragScrollSpeed: number;

  // Shared pointer coordination
  onPointerSessionRequest: StartPointerSession;
  onClickSuppressionRequest: () => void;
  isClickSuppressed: () => boolean;
}

// Period construction
/**
 * Builds a nonempty chronological window with unique, sortable keys containing the requested anchor.
 * count is a number of columns; start/end dates locate each column for navigation and hit testing.
 */
export interface PeriodDefinition {
  navigate?: (anchor: string, direction: 'previous' | 'next') => string;
  buildInitial: (anchor: string, count: number) => CalendarPeriod[];
  formatLabel: (period: CalendarPeriod) => string;
}

// Row data and rendering contexts
/** Row ID → period key → buffered records; repeated records are deduplicated by item ID within each row. */
export type RowPeriodData<TItemData> = Record<string, Record<PeriodKey, readonly TItemData[]>>;
/** Row ID → source records; an absent row entry renders as empty. */
export type RowItemData<TItemData> = Record<string, readonly TItemData[] | undefined>;

/**
 * Supplies an original record and inclusive range with its first/last rendered columns.
 * For an Aug 18–20 item in an Aug 19–21 window, range starts Aug 18 and visibleStart is Aug 19.
 */
export interface BuildItemContext<TRow, TItemData> {
  // Source record
  row: TRow;
  data: TItemData;
  range: ItemRange;

  // Visible placement and interactions
  visibleStart: CalendarPeriod;
  visibleEnd: CalendarPeriod;
  /** Forward to the domain item's shared Item shell; this is data/callbacks, not an instance API. */
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
/**
 * Resource rows and their source records; callers own persisted changes and controlled row selection.
 * Move/resize promises are not awaited: callbacks must handle save failures and reconcile items themselves.
 */
export interface TimelineCalendarProps<TRow, TItemData> {
  // Grid layout and accessibility
  ariaLabel?: string;
  /** Fixed row height in CSS pixels. */
  rowHeight?: number;
  overscanRows?: number;

  // Periods and range loading
  periodDefinition?: PeriodDefinition;
  initialDate?: string;
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
  navigateDate?: (anchor: string, direction: 'previous' | 'next') => string;

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
  /** Final drop check against the current destination row; false discards the move without saving. */
  canItemMove?: (context: ItemMoveContext<TRow, TItemData>) => boolean;
  onItemMove?: (context: ItemMoveContext<TRow, TItemData>) => void | Promise<void>;
  onItemResize?: (context: ItemResizeContext<TRow, TItemData>) => void | Promise<void>;
  /** Positive edge-zone depth in CSS pixels. */
  dragEdgeSize?: number;
  /** Maximum CSS pixels scrolled per animation frame, at least 2. */
  dragScrollSpeed?: number;

  // Cell actions
  onCellActivate?: (context: CalendarCellContext<TRow, TItemData>) => void;
  getCellActions?: (context: CalendarCellContext<TRow, TItemData>) => readonly CalendarCellAction[];
}
