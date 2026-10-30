import { flexRender, type Header } from '@tanstack/react-table';
import type { KeyboardEvent, MouseEvent, TouchEvent } from 'react';
import type { ColumnSizingState } from '@tanstack/react-table';
import { getTableColumnHeader } from '../Table.types';
import { ariaSortFor } from '../table.utils';

interface TableHeaderProps<T> {
  headers: Header<T, unknown>[];
  onResizeStart: () => ColumnSizingState | undefined;
  onResizeDrag: (header: Header<T, unknown>, event: MouseEvent<HTMLButtonElement> | TouchEvent<HTMLButtonElement>) => void;
  onToggleSort: (columnKey: string) => void;
  onResizeByStep: (columnId: string, currentWidth: number, direction: 'ArrowLeft' | 'ArrowRight', lockedWidths?: ColumnSizingState) => void;
}

interface TableHeaderCellProps<T> extends Omit<TableHeaderProps<T>, 'headers'> {
  header: Header<T, unknown>;
}

function TableHeaderCell<T>({
  header,
  onResizeStart,
  onResizeDrag,
  onToggleSort,
  onResizeByStep,
}: TableHeaderCellProps<T>) {
  const column = header.column.columnDef;
  const sortDirection = header.column.getIsSorted();
  const headerLabel = flexRender(header.column.columnDef.header, header.getContext());

  const handleResizeKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
    event.preventDefault();
    const lockedWidths = onResizeStart();
    onResizeByStep(
      header.column.id,
      lockedWidths?.[header.column.id] ?? header.getSize(),
      event.key,
      lockedWidths,
    );
  };

  return (
    <th
      data-column-id={header.column.id}
      aria-sort={ariaSortFor(sortDirection)}
    >
      {header.column.getCanSort() ? (
        <button type="button" className="table-sort-trigger" onClick={() => onToggleSort(header.column.id)}>
          {headerLabel}
          <span aria-hidden="true" className="table-sort-indicator" data-direction={sortDirection || 'none'} />
        </button>
      ) : headerLabel}
      {header.column.getCanResize() && (
        <button
          type="button"
          className="table-resize-handle"
          aria-label={`Resize ${getTableColumnHeader(column)} column`}
          onMouseDown={event => onResizeDrag(header, event)}
          onTouchStart={event => onResizeDrag(header, event)}
          onDoubleClick={() => header.column.resetSize()}
          onKeyDown={handleResizeKeyDown}
        />
      )}
    </th>
  );
}

export default function TableHeader<T>({
  headers,
  onResizeStart,
  onResizeDrag,
  onToggleSort,
  onResizeByStep,
}: TableHeaderProps<T>) {
  return (
    <thead>
      <tr>
        {headers.map(header => (
          <TableHeaderCell
            key={header.id}
            header={header}
            onResizeStart={onResizeStart}
            onResizeDrag={onResizeDrag}
            onToggleSort={onToggleSort}
            onResizeByStep={onResizeByStep}
          />
        ))}
      </tr>
    </thead>
  );
}
