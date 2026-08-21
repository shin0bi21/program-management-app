import { flexRender, type Row } from '@tanstack/react-table';
import { memo, type KeyboardEvent, type MouseEvent } from 'react';
import type { TableNavigationKey } from '../Table.types';

interface TableRowProps<T> {
  row: Row<T>;
  selected: boolean;
  tabbable: boolean;
  rowIndex: number;
  onSelect?: (item: T) => void;
  onNavigate: (rowIndex: number, id: TableNavigationKey) => void;
  columnWidths: Record<string, number>;
}

function TableRowComponent<T>({
  row,
  selected,
  tabbable,
  rowIndex,
  onSelect,
  onNavigate,
  columnWidths,
}: TableRowProps<T>) {
  const item = row.original;
  const select = () => onSelect?.(item);
  const isInteractiveTarget = (target: HTMLElement) => Boolean(
    target.closest('button, a, input, select, textarea, [role="menuitem"]'),
  );

  const handleClick = (event: MouseEvent<HTMLTableRowElement>) => {
    if (!isInteractiveTarget(event.target as HTMLElement)) select();
  };

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
      {row.getVisibleCells().map(cell => (
        <td
          key={cell.id}
          data-column-id={cell.column.id}
          style={{ width: columnWidths[cell.column.id] }}
        >
          {flexRender(cell.column.columnDef.cell, cell.getContext())}
        </td>
      ))}
    </tr>
  );
}

const TableRow = memo(TableRowComponent) as typeof TableRowComponent;

export default TableRow;
