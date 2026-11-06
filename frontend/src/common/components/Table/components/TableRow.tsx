import { flexRender, type Cell, type Row } from '@tanstack/react-table';
import { memo, type KeyboardEvent, type MouseEvent } from 'react';
import type { TableNavigationKey } from '../Table.types';

interface TableRowProps<T> {
  row: Row<T>;
  cells: Cell<T, unknown>[];
  selected: boolean;
  tabbable: boolean;
  rowIndex: number;
  onSelect?: (item: T) => void;
  onNavigate: (rowIndex: number, key: TableNavigationKey) => void;
}

/**
 * Displays one record's visible cells and supports selecting or navigating its row.
 * @param props.row - Table row containing the original record.
 * @param props.cells - Cells for columns that are currently visible.
 * @param props.rowIndex - Zero-based position in the displayed records, used by the navigation callback.
 * @param props.onNavigate - Handles focus and optional selection after a row navigation key is pressed.
 * @example Pressing Enter on the row selects its record; Enter on its Edit button does not.
 */
function TableRowComponent<T>({
  row,
  cells,
  selected,
  tabbable,
  rowIndex,
  onSelect,
  onNavigate,
}: TableRowProps<T>) {
  const item = row.original;

  /**
   * Reports the original typed record when application selection is enabled.
   * @example Selecting row task-1 passes that Task object to onSelect.
   */
  const select = () => onSelect?.(item);

  /**
   * Selects row clicks outside nested native controls and menu items.
   * @example Clicking a cell label selects; clicking an input leaves selection unchanged.
   */
  const handleClick = (event: MouseEvent<HTMLTableRowElement>) => {
    if (!isInteractiveTarget(event.target as HTMLElement)) select();
  };

  /**
   * Selects on Enter or Space, or delegates arrow/Home/End navigation, after preventing the default action.
   * Keys from nested native controls and menu items are left untouched.
   * @example ArrowDown requests navigation from this rowIndex to the next row.
   */
  const handleKeyDown = (event: KeyboardEvent<HTMLTableRowElement>) => {
    if (isInteractiveTarget(event.target as HTMLElement)) return;

    if (onSelect && (event.key === 'Enter' || event.key === ' ')) {
      event.preventDefault();
      select();
      return;
    }

    if (event.key === 'ArrowUp' || event.key === 'ArrowDown' || event.key === 'Home' || event.key === 'End') {
      event.preventDefault();
      onNavigate(rowIndex, event.key);
    }
  };

  return (
    <tr
      className={[
        selected ? 'table-row--selected' : '',
        onSelect ? 'table-row--selectable' : '',
      ].filter(Boolean).join(' ') || undefined}
      aria-selected={onSelect ? selected : undefined}
      data-table-row-index={rowIndex}
      tabIndex={tabbable ? 0 : -1}
      onClick={onSelect ? handleClick : undefined}
      onKeyDown={handleKeyDown}
    >
      {cells.map(cell => (
        <td
          key={cell.id}
          data-column-id={cell.column.id}
        >
          {flexRender(cell.column.columnDef.cell, cell.getContext())}
        </td>
      ))}
    </tr>
  );
}

const TableRow = memo(TableRowComponent) as typeof TableRowComponent;

export default TableRow;

/**
 * Detects whether an event target is inside a native button, link, form control, or menu item.
 * @param target - Originating element, which may be a child of the control itself.
 * @example A span inside a button is interactive; plain cell text is not.
 */
function isInteractiveTarget(target: HTMLElement) {
  return Boolean(target.closest('button, a, input, select, textarea, [role="menuitem"]'));
}
