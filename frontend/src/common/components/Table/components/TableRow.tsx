import { memo, type KeyboardEvent, type MouseEvent } from 'react';
import type { TableColumn, TableNavigationKey } from '../Table.types';

interface TableRowProps<T> {
  item: T;
  columns: TableColumn<T>[];
  selected: boolean;
  tabbable: boolean;
  rowIndex: number;
  onSelect?: (item: T) => void;
  onNavigate: (rowIndex: number, key: TableNavigationKey) => void;
  columnWidths: Record<string, number>;
}

function TableRowComponent<T>({
  item,
  columns,
  selected,
  tabbable,
  rowIndex,
  onSelect,
  onNavigate,
  columnWidths,
}: TableRowProps<T>) {
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
      {columns.map(column => (
        <td key={column.key} className={column.className} style={{ width: columnWidths[column.key] }}>
          {column.render(item)}
        </td>
      ))}
    </tr>
  );
}

const TableRow = memo(TableRowComponent) as typeof TableRowComponent;

export default TableRow;
