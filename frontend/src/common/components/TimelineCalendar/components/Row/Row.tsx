import {
  Fragment,
  memo,
  type CSSProperties,
  type ReactNode,
} from 'react';
import Cell from '../Cell/Cell';
import type {
  ItemStateRef,
  ItemEnvironment,
  BuildItemContext,
  ItemDensity,
  CalendarCellAction,
  CalendarCellContext,
  CalendarPeriod,
  ItemActivateContext,
  ItemCapabilities,
  ItemCapabilityContext,
  ItemRange,
  ItemMoveContext,
  ItemResizeContext,
} from '../../types';

import { getItemDensity, positionItems, type PositionedItem } from '../../utils/itemPosition';

const HIDE_ITEM_SUMMARIES_AT = 8;
const ITEM_SPACING = {
  normal: { padding: 8, gap: 4 },
  compact: { padding: 6, gap: 4 },
  dense: { padding: 4, gap: 4 },
};

interface RowProps<TRow, TItemData> {
  // Row layout
  periods: readonly CalendarPeriod[];
  leadingPeriodWidth: number;
  gridColumns: string;
  rowHeight: number;

  // Row identity and selection
  row: TRow;
  rowId: string;
  rowIndex: number;
  renderRow: (context: { row: TRow; index: number }) => ReactNode;
  selected: boolean;
  onRowSelect?: (row: TRow, source?: 'row' | 'item') => void;

  // Item data and rendering
  items: readonly TItemData[];
  getItemId: (item: TItemData) => string;
  getItemRange: (item: TItemData) => ItemRange;
  buildItem: (context: BuildItemContext<TRow, TItemData>) => ReactNode;
  getItemCapabilities?: (context: ItemCapabilityContext<TRow, TItemData>) => ItemCapabilities;

  // Item interactions
  itemMoveEnabled: boolean;
  itemResizeEnabled: boolean;
  itemEnvironment: ItemEnvironment;
  itemState: ItemStateRef<TRow, TItemData>;
  onItemActivate?: (context: ItemActivateContext<TRow, TItemData>) => void;
  onItemMove: (context: ItemMoveContext<TRow, TItemData>) => void;
  onItemResize: (context: ItemResizeContext<TRow, TItemData>) => void;

  // Cell actions
  onCellClick?: (context: CalendarCellContext<TRow, TItemData>) => void;
  getCellActions?: (context: CalendarCellContext<TRow, TItemData>) => readonly CalendarCellAction[];
}

type RowComponent = <TRow, TItemData>(
  props: RowProps<TRow, TItemData>,
) => ReactNode;

const Row = memo(function Row<TRow, TItemData>(props: RowProps<TRow, TItemData>) {
  const {
    // Row layout
    periods, leadingPeriodWidth, gridColumns, rowHeight,

    // Row identity and selection
    row, rowId, rowIndex, renderRow, selected, onRowSelect,

    // Item data and rendering
    items, getItemRange, buildItem,

    // Cell actions
    onCellClick, getCellActions,
  } = props;
  const selectRow = () => {
    if (!selected) onRowSelect?.(row, 'item');
  };

  const positionedItems = positionItems(items, periods, getItemRange);
  const cells = buildCellContexts(row, rowIndex, periods, positionedItems);
  const rowItems = buildRowItems(positionedItems, props, selectRow);
  const rowStyle = { gridTemplateColumns: gridColumns, height: rowHeight };
  const itemLayerStyle = { gridTemplateColumns: gridColumns };
  const leadingPeriodStyle = { width: leadingPeriodWidth };

  return (
    <div
      className={`row${selected ? ' selected' : ''}`}
      data-row-id={rowId}
      role="row"
      style={rowStyle}
    >
      <div className="row-header" role="rowheader">
        {onRowSelect ? (
          <button
            type="button"
            className="row-select"
            aria-pressed={selected}
            onClick={() => onRowSelect?.(row, 'row')}
          >
            {renderRow({ row, index: rowIndex })}
          </button>
        ) : renderRow({ row, index: rowIndex })}
      </div>
      <div style={leadingPeriodStyle} aria-hidden="true" />
      {cells.map(context => (
        <Cell
          key={context.period.key}
          context={context}
          rowId={rowId}
          onCellClick={onCellClick}
          getCellActions={getCellActions}
        />
      ))}
      {rowItems.length > 0 && (
        <div className="item-layer" style={itemLayerStyle}>
          {rowItems.map(({ id, context }) => (
            <Fragment key={id}>{buildItem(context)}</Fragment>
          ))}
        </div>
      )}
    </div>
  );
}) as RowComponent;

export default Row;

/**
 * Produces one context per visible period, including every item covering that period.
 * Requires: positioned-item indices refer to the supplied visible periods.
 * Example: an item spanning Aug 19–20 appears in both the Aug 19 and Aug 20 cell contexts.
 */
function buildCellContexts<TRow, TItemData>(
  row: TRow,
  rowIndex: number,
  periods: readonly CalendarPeriod[],
  positionedItems: readonly PositionedItem<TItemData>[],
): CalendarCellContext<TRow, TItemData>[] {
  return periods.map((period, periodIndex) => ({
    row,
    rowIndex,
    period,
    items: positionedItems
      .filter(item => item.startIndex <= periodIndex && item.endIndex >= periodIndex)
      .map(item => item.item),
  }));
}

/**
 * Produces item contexts containing row-calculated layout and callbacks to the calendar.
 * Requires: positioned-item indices refer to the supplied visible periods.
 * Example: an item starting before the visible periods keeps its original start
 * and reports startsInWindow=false, so Item omits its start resize handle.
 */
function buildRowItems<TRow, TItemData>(
  positionedItems: readonly PositionedItem<TItemData>[],
  {
    // Row layout and identity
    periods, rowHeight, row, rowId,

    // Item data and rendering
    getItemId, getItemCapabilities,

    // Item interactions
    itemMoveEnabled, itemResizeEnabled, itemEnvironment, itemState,
    onItemActivate, onItemMove, onItemResize,
  }: RowProps<TRow, TItemData>,
  onSelect: () => void,
) {
  const environment: ItemEnvironment = {
    ...itemEnvironment,
    onPointerSessionRequest: request => itemEnvironment.onPointerSessionRequest(request),
    onClickSuppressionRequest: () => itemEnvironment.onClickSuppressionRequest(),
  };

  return positionedItems.map(positionedItem => {
    const { item, range, startIndex, endIndex, laneCount } = positionedItem;
    const id = getItemId(item);
    const capabilities = getItemCapabilities?.({ row, data: item, range });
    const startsInWindow = range.start === periods[startIndex].key;
    const endsInWindow = range.end === periods[endIndex].key;
    const fullyVisible = startsInWindow && endsInWindow;
    const density = getItemDensity(laneCount);

    const context: BuildItemContext<TRow, TItemData> = {
      row,
      data: item,
      range,
      visibleStart: periods[startIndex],
      visibleEnd: periods[endIndex],
      calendar: {
        target: { row, data: item, range },
        stateRef: itemState,
        layout: {
          id, rowId, start: range.start, end: range.end,
          style: getItemStyle(positionedItem, density, rowHeight),
          density,
          hideSummary: laneCount >= HIDE_ITEM_SUMMARIES_AT,
          startsInWindow,
          endsInWindow,
        },
        movable: itemMoveEnabled && (capabilities?.draggable ?? false) && fullyVisible,
        resizable: itemResizeEnabled && (capabilities?.resizable ?? false),
        environment,
        onSelect,
        onActivate: () => onItemActivate?.({ row, data: item, range }),
        onMove: context => onItemMove(context),
        onResize: context => onItemResize(context),
      },
    };

    return { id, context };
  });
}

/**
 * Produces grid placement and lane spacing within the fixed row height.
 * Requires: laneCount > 0 and 0 <= lane < laneCount.
 * Example: normal density, lane 0, and startIndex = endIndex = 0 produce
 * gridColumn "3 / 4", top 8, and height 26.
 */
function getItemStyle<TItemData>(
  { startIndex, endIndex, lane, laneCount }: PositionedItem<TItemData>,
  density: ItemDensity,
  rowHeight: number,
): CSSProperties {
  const { padding, gap } = ITEM_SPACING[density];
  let height = 26;

  if (density !== 'normal') {
    const totalPadding = padding * 2;
    const totalGaps = gap * (laneCount - 1);
    const availableHeight = rowHeight - totalPadding - totalGaps;
    height = availableHeight / laneCount;
  }

  const top = padding + lane * (height + gap);

  // The header and leading spacer occupy two columns; the ending grid line is exclusive.
  return {
    gridColumn: `${startIndex + 3} / ${endIndex + 4}`,
    gridRow: 1,
    top,
    height,
  };
}
