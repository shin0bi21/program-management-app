import {
  memo,
  type MutableRefObject,
  type ReactNode,
} from 'react';
import Cell from '../Cell/Cell';
import type { ItemMovePointerHandler } from '../../hooks/useItemMove/useItemMove';
import type {
  ItemResizePointerHandler,
  ItemResizeKeyHandler,
} from '../../hooks/useItemResize/useItemResize';
import type {
  BuildItemContext,
  CalendarCellAction,
  CalendarCellContext,
  CalendarPeriod,
  ItemActivateContext,
  ItemCapabilities,
  ItemCapabilityContext,
  ItemRange,
} from '../../types';
import { getItemDensity, positionItems, type ItemDensity } from '../../utils/itemPosition';

const HIDE_ITEM_SUMMARIES_AT = 7;
const ITEM_SPACING = {
  normal: { padding: 8, gap: 8 },
  compact: { padding: 7, gap: 3 },
  dense: { padding: 4, gap: 2 },
};

interface RowProps<TRow, TItemData> {
  row: TRow;
  rowId: string;
  rowIndex: number;
  items: readonly TItemData[];
  getItemRange: (item: TItemData) => ItemRange;
  periods: readonly CalendarPeriod[];
  leadingPeriodWidth: number;
  gridColumns: string;
  rowHeight: number;
  getItemId: (item: TItemData) => string;
  renderRow: (context: { row: TRow; index: number }) => ReactNode;
  selected: boolean;
  onRowSelect?: (row: TRow) => void;
  buildItem: (context: BuildItemContext<TRow, TItemData>) => ReactNode;
  getItemCapabilities?: (context: ItemCapabilityContext<TRow, TItemData>) => ItemCapabilities;
  onItemActivate?: (context: ItemActivateContext<TRow, TItemData>) => void;
  itemResizeEnabled: boolean;
  onItemResizePointerDown: ItemResizePointerHandler<TRow, TItemData>;
  onItemResizeKeyDown: ItemResizeKeyHandler<TRow, TItemData>;
  suppressResizeClickRef: MutableRefObject<boolean>;
  itemMoveEnabled: boolean;
  onItemMovePointerDown: ItemMovePointerHandler<TRow, TItemData>;
  suppressMoveClickRef: MutableRefObject<boolean>;
  onCellClick?: (context: CalendarCellContext<TRow, TItemData>) => void;
  getCellActions?: (context: CalendarCellContext<TRow, TItemData>) => readonly CalendarCellAction[];
}

function Row<TRow, TItemData>({
  row,
  rowId,
  rowIndex,
  items,
  getItemRange,
  periods,
  leadingPeriodWidth,
  gridColumns,
  rowHeight,
  getItemId,
  renderRow,
  selected,
  onRowSelect,
  buildItem,
  getItemCapabilities,
  onItemActivate,
  itemResizeEnabled,
  onItemResizePointerDown,
  onItemResizeKeyDown,
  suppressResizeClickRef,
  itemMoveEnabled,
  onItemMovePointerDown,
  suppressMoveClickRef,
  onCellClick,
  getCellActions,
}: RowProps<TRow, TItemData>) {
  const positionedItems = positionItems(items, periods, getItemRange);
  const selectRow = () => {
    if (!selected) onRowSelect?.(row);
  };

  return (
    <div
      className={`row${selected ? ' selected' : ''}`}
      data-row-id={rowId}
      role="row"
      style={{ gridTemplateColumns: gridColumns, height: rowHeight }}
    >
      <div className="row-header" role="rowheader">
        {onRowSelect ? (
          <button
            type="button"
            className="row-select"
            aria-pressed={selected}
            onClick={selectRow}
          >
            {renderRow({ row, index: rowIndex })}
          </button>
        ) : renderRow({ row, index: rowIndex })}
      </div>
      <div style={{ width: leadingPeriodWidth }} aria-hidden="true" />
      {periods.map((period, periodIndex) => (
        <Cell
          key={period.key}
          context={{
            row,
            rowIndex,
            period,
            items: positionedItems
              .filter(item => item.startIndex <= periodIndex && item.endIndex >= periodIndex)
              .map(item => item.item),
          }}
          rowId={rowId}
          onCellClick={onCellClick}
          getCellActions={getCellActions}
        />
      ))}
      {positionedItems.length > 0 && (
        <div className="item-layer" style={{ gridTemplateColumns: gridColumns }}>
          {positionedItems.map(({ item, range, startIndex, endIndex, lane, laneCount }) => {
            const capabilities = getItemCapabilities?.({ row, data: item, range });
            const startsInWindow = range.start === periods[startIndex].key;
            const endsInWindow = range.end === periods[endIndex].key;
            const fullyVisible = startsInWindow && endsInWindow;

            const movable = itemMoveEnabled
              && (capabilities?.draggable ?? false)
              && fullyVisible;
            const resizable = itemResizeEnabled && (capabilities?.resizable ?? false);

            const density = getItemDensity(laneCount);
            const geometry = getItemGeometry(density, lane, laneCount, rowHeight);
            const itemId = getItemId(item);
            const itemClassName = [
              'item',
              'positioned-item',
              density,
              laneCount >= HIDE_ITEM_SUMMARIES_AT ? 'summaries-hidden' : '',
              movable ? 'draggable' : '',
              resizable ? 'resizable' : '',
            ].filter(Boolean).join(' ');

            const context = {
              row,
              data: item,
              range,
              visibleStart: periods[startIndex],
              visibleEnd: periods[endIndex],
            };

            return (
              <div
                key={itemId}
                className={itemClassName}
                data-item-density={density}
                data-item-row-id={rowId}
                data-item-start={range.start}
                data-item-end={range.end}
                style={{
                  gridColumn: `${startIndex + 3} / ${endIndex + 4}`,
                  gridRow: 1,
                  top: geometry.top,
                  height: geometry.height,
                }}
                onPointerDown={movable ? event => onItemMovePointerDown(event, { row, item, range }) : undefined}
                onClickCapture={event => {
                  if (suppressResizeClickRef.current || suppressMoveClickRef.current) {
                    event.preventDefault();
                    event.stopPropagation();
                    return;
                  }

                  selectRow();
                }}
                onClick={() => onItemActivate?.({ row, data: item, range })}
              >
                {resizable && startsInWindow && (
                  <button
                    type="button"
                    className="resize-handle start"
                    aria-label={`Resize start of ${itemId}`}
                    onClick={event => event.stopPropagation()}
                    onKeyDown={event => onItemResizeKeyDown(event, { row, item, range, edge: 'start' })}
                    onPointerDown={event => onItemResizePointerDown(event, { row, item, range, edge: 'start' })}
                  />
                )}
                {buildItem(context)}
                {resizable && endsInWindow && (
                  <button
                    type="button"
                    className="resize-handle end"
                    aria-label={`Resize end of ${itemId}`}
                    onClick={event => event.stopPropagation()}
                    onKeyDown={event => onItemResizeKeyDown(event, { row, item, range, edge: 'end' })}
                    onPointerDown={event => onItemResizePointerDown(event, { row, item, range, edge: 'end' })}
                  />
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default memo(Row) as typeof Row;

function getItemGeometry(density: ItemDensity, lane: number, laneCount: number, rowHeight: number) {
  const { padding, gap } = ITEM_SPACING[density];
  let height = 26;

  if (density !== 'normal') {
    const totalPadding = padding * 2;
    const totalGaps = gap * (laneCount - 1);
    const availableHeight = rowHeight - totalPadding - totalGaps;
    height = availableHeight / laneCount;
  }

  const top = padding + lane * (height + gap);
  return { top, height };
}
