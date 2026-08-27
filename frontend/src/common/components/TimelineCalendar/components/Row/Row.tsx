import {
  memo,
  type KeyboardEvent,
  type MutableRefObject,
  type PointerEvent,
  type ReactNode,
} from 'react';
import Cell from '../Cell/Cell';
import type { ItemMoveStart } from '../../hooks/useItemMove/useItemMove';
import type {
  ItemResize,
  ItemResizeTarget,
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

function getItemGeometry(density: ItemDensity, lane: number, laneCount: number, rowHeight: number) {
  const padding = density === 'dense' ? 4 : density === 'compact' ? 7 : 8;
  const gap = density === 'dense' ? 2 : density === 'compact' ? 3 : 8;
  const height = density === 'normal'
    ? 26
    : (rowHeight - (padding * 2) - (gap * (laneCount - 1))) / laneCount;
  return { top: padding + (lane * (height + gap)), height };
}

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
  beginItemResize: (resize: ItemResize<TRow, TItemData>) => void;
  resizeByKeyboard: (resize: ItemResizeTarget<TRow, TItemData>, direction: -1 | 1) => void;
  suppressResizeClickRef: MutableRefObject<boolean>;
  itemMoveEnabled: boolean;
  beginItemMove: (move: ItemMoveStart<TRow, TItemData>) => void;
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
  beginItemResize,
  resizeByKeyboard,
  suppressResizeClickRef,
  itemMoveEnabled,
  beginItemMove,
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

            const beginResize = (event: PointerEvent<HTMLButtonElement>, edge: 'start' | 'end') => {
              event.stopPropagation();

              if (event.pointerType === 'touch' || event.button !== 0) return;

              beginItemResize({
                pointerId: event.pointerId,
                startX: event.clientX,
                sourceElement: event.currentTarget,
                itemElement: event.currentTarget.parentElement!,
                row,
                item,
                range,
                edge,
              });
            };

            const resizeWithKeyboard = (event: KeyboardEvent<HTMLButtonElement>, edge: 'start' | 'end') => {
              if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;

              event.preventDefault();

              resizeByKeyboard(
                { row, item, range, edge },
                event.key === 'ArrowLeft' ? -1 : 1,
              );
            };

            const beginMove = (event: PointerEvent<HTMLDivElement>) => {
              if (event.pointerType === 'touch' || event.button !== 0) return;

              beginItemMove({
                pointerId: event.pointerId,
                startX: event.clientX,
                startY: event.clientY,
                sourceElement: event.currentTarget,
                row,
                item,
                range,
              });
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
                onPointerDown={movable ? beginMove : undefined}
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
                    onKeyDown={event => resizeWithKeyboard(event, 'start')}
                    onPointerDown={event => beginResize(event, 'start')}
                  />
                )}
                {buildItem(context)}
                {resizable && endsInWindow && (
                  <button
                    type="button"
                    className="resize-handle end"
                    aria-label={`Resize end of ${itemId}`}
                    onClick={event => event.stopPropagation()}
                    onKeyDown={event => resizeWithKeyboard(event, 'end')}
                    onPointerDown={event => beginResize(event, 'end')}
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
