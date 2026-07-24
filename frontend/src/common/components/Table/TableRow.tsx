import { memo, type KeyboardEvent, type MouseEvent } from 'react';
import type { TableColumn, TableNavigationKey } from './Table.types';

interface TableRowProps<T> {
  item: T;
  columns: TableColumn<T>[];
  selected: boolean;
  tabbable: boolean;
  rowIndex: number;
  onSelect?: (item: T) => void;
  onNavigate: (rowIndex: number, key: TableNavigationKey) => void;
}

function TableRowComponent<T>({
  item,
  columns,
  selected,
  tabbable,
  rowIndex,
  onSelect,
  onNavigate,
}: TableRowProps<T>) {
  const select = () => onSelect?.(item);
  const isInteractiveTarget = (target: HTMLElement) => Boolean(
    target.closest('button, a, input, select, textarea, [role="menuitem"]'),
  );

  const handleClick = (event: MouseEvent<HTMLTableRowElement>) => {
    if (!isInteractiveTarget(event.target as HTMLElement)) select();
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLTableRowElement>) => {
    const target = event.target as HTMLElement;
    if (isInteractiveTarget(target)) return;

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
        <td key={column.key} className={column.className}>{column.render(item)}</td>
      ))}
    </tr>
  );
}

// Preserve the generic component signature through React.memo.
const TableRow = memo(TableRowComponent) as typeof TableRowComponent;

export default TableRow;
