import { memo, type ReactNode } from 'react';
import Row from '../Row/Row';
import type {
  ItemStateRef,
  ItemEnvironment,
  BuildItemContext,
  CalendarCellAction,
  CalendarCellContext,
  CalendarPeriod,
  ItemActivateContext,
  ItemCapabilities,
  ItemCapabilityContext,
  ItemRange,
  ItemMoveContext,
  ItemResizeContext,
  RowItemData,
} from '../../types';

interface GridProps<TRow, TItemData> {
  // Grid layout
  gridColumns: string;
  rowHeight: number;
  leadingPeriodWidth: number;
  topSpacerHeight: number;
  bottomSpacerHeight: number;

  // Period headers
  periods: readonly CalendarPeriod[];
  formatPeriodLabel: (period: CalendarPeriod) => string;
  today: Date;

  // Rows and selection
  rows: readonly TRow[];
  firstRowIndex: number;
  rowHeader: ReactNode;
  getRowId: (row: TRow) => string;
  renderRow: (context: { row: TRow; index: number }) => ReactNode;
  selectedRowId?: string | null;
  onRowSelect?: (row: TRow, source?: 'row' | 'item') => void;

  // Item data and rendering
  items: RowItemData<TItemData>;
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

const EMPTY_ITEMS = [] as const;

type GridComponent = <TRow, TItemData>(props: GridProps<TRow, TItemData>) => ReactNode;

/**
 * Displays the visible date headers and resource rows, keeping space for offscreen content.
 * Layout widths and heights are in pixels; firstRowIndex is the slice's zero-based offset in all rows.
 * @param props.rows - Resource slice whose original indices reach row renderers and cell contexts.
 * @param props.periods - Ordered visible date columns; today matches a start-inclusive, end-exclusive interval.
 * @param props.items - Records keyed by getRowId; missing entries render an empty row.
 * @example With firstRowIndex = 4, two visible staff rows receive indices 4 and 5;
 * at rowHeight = 92, topSpacerHeight = 368 reserves the four preceding rows.
 */
const Grid = memo(function Grid<TRow, TItemData>({
  // Grid layout
  gridColumns,
  rowHeight,
  leadingPeriodWidth,
  topSpacerHeight,
  bottomSpacerHeight,

  // Period headers
  periods,
  formatPeriodLabel,
  today,

  // Rows and selection
  rows,
  firstRowIndex,
  rowHeader,
  getRowId,
  renderRow,
  selectedRowId,
  onRowSelect,

  // Item data and rendering
  items,
  getItemId,
  getItemRange,
  buildItem,
  getItemCapabilities,

  // Item interactions
  itemMoveEnabled,
  itemResizeEnabled,
  itemEnvironment,
  itemState,
  onItemActivate,
  onItemMove,
  onItemResize,

  // Cell actions
  onCellClick,
  getCellActions,
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

            periods={periods}
            leadingPeriodWidth={leadingPeriodWidth}
            gridColumns={gridColumns}
            rowHeight={rowHeight}

            row={row}
            rowId={rowId}
            rowIndex={firstRowIndex + visibleIndex}
            renderRow={renderRow}
            selected={selectedRowId === rowId}
            onRowSelect={onRowSelect}

            items={items[rowId] ?? EMPTY_ITEMS}
            getItemId={getItemId}
            getItemRange={getItemRange}
            buildItem={buildItem}
            getItemCapabilities={getItemCapabilities}

            itemMoveEnabled={itemMoveEnabled}
            itemResizeEnabled={itemResizeEnabled}
            itemEnvironment={itemEnvironment}
            itemState={itemState}
            onItemActivate={onItemActivate}
            onItemMove={onItemMove}
            onItemResize={onItemResize}

            onCellClick={onCellClick}
            getCellActions={getCellActions}
          />
        );
      })}
      <div style={{ height: bottomSpacerHeight }} aria-hidden="true" />
    </>
  );
}) as GridComponent;

export default Grid;
