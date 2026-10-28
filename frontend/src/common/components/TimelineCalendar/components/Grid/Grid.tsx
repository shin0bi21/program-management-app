import { memo, type MutableRefObject, type ReactNode } from 'react';
import Row from '../Row/Row';
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
  RowItemData,
} from '../../types';

interface GridProps<TRow, TItemData> {
  rows: readonly TRow[];
  firstRowIndex: number;
  periods: readonly CalendarPeriod[];
  leadingPeriodWidth: number;
  items: RowItemData<TItemData>;
  getItemRange: (item: TItemData) => ItemRange;
  gridColumns: string;
  rowHeight: number;
  topSpacerHeight: number;
  bottomSpacerHeight: number;
  rowHeader: ReactNode;
  getRowId: (row: TRow) => string;
  getItemId: (item: TItemData) => string;
  renderRow: (context: { row: TRow; index: number }) => ReactNode;
  selectedRowId?: string | null;
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
  formatPeriodLabel: (period: CalendarPeriod) => string;
  today: Date;
}

const EMPTY_ITEMS = [] as const;

function Grid<TRow, TItemData>({
  rows,
  firstRowIndex,
  periods,
  leadingPeriodWidth,
  items,
  getItemRange,
  gridColumns,
  rowHeight,
  topSpacerHeight,
  bottomSpacerHeight,
  rowHeader,
  getRowId,
  getItemId,
  renderRow,
  selectedRowId,
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
  formatPeriodLabel,
  today,
}: GridProps<TRow, TItemData>) {
  const currentPeriodKey = periods.find(period => today >= period.start && today < period.end)?.key;

  return (
    <>
      <div className="grid-header" role="row" style={{ gridTemplateColumns: gridColumns }}>
        <div className="corner" role="columnheader">{rowHeader}</div>
        <div style={{ width: leadingPeriodWidth }} aria-hidden="true" />
        {periods.map(period => (
          <div
            key={period.key}
            className={`period${period.key === currentPeriodKey ? ' today' : ''}`}
            data-period-key={period.key}
            role="columnheader"
          >
            <span>{formatPeriodLabel(period)}</span>
          </div>
        ))}
      </div>

      <div style={{ height: topSpacerHeight }} aria-hidden="true" />
      {rows.map((row, visibleIndex) => {
        const rowId = getRowId(row);
        return (
          <Row
            key={rowId}
            row={row}
            rowId={rowId}
            rowIndex={firstRowIndex + visibleIndex}
            items={items[rowId] ?? EMPTY_ITEMS}
            getItemRange={getItemRange}
            periods={periods}
            leadingPeriodWidth={leadingPeriodWidth}
            gridColumns={gridColumns}
            rowHeight={rowHeight}
            getItemId={getItemId}
            renderRow={renderRow}
            selected={selectedRowId === rowId}
            onRowSelect={onRowSelect}
            buildItem={buildItem}
            getItemCapabilities={getItemCapabilities}
            onItemActivate={onItemActivate}
            itemResizeEnabled={itemResizeEnabled}
            onItemResizePointerDown={onItemResizePointerDown}
            onItemResizeKeyDown={onItemResizeKeyDown}
            suppressResizeClickRef={suppressResizeClickRef}
            itemMoveEnabled={itemMoveEnabled}
            onItemMovePointerDown={onItemMovePointerDown}
            suppressMoveClickRef={suppressMoveClickRef}
            onCellClick={onCellClick}
            getCellActions={getCellActions}
          />
        );
      })}
      <div style={{ height: bottomSpacerHeight }} aria-hidden="true" />
    </>
  );
}

export default memo(Grid) as typeof Grid;
