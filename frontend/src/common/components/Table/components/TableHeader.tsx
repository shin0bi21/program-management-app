import { flexRender, type Header } from '@tanstack/react-table';
import type { KeyboardEvent } from 'react';
import { flushSync } from 'react-dom';
import type { ColumnSizingState } from '@tanstack/react-table';
import type { TableColumn } from '../Table.types';
import { ariaSortFor } from '../table.utils';

interface TableHeaderProps<T> {
  headers: Header<T, unknown>[];
  canResize: boolean;
  onResizeStart: () => ColumnSizingState | undefined;
  onToggleSort: (column: TableColumn<T>) => void;
  onNudgeWidth: (columnId: string, currentWidth: number, direction: 'ArrowLeft' | 'ArrowRight', lockedWidths?: ColumnSizingState) => void;
}

interface TableHeaderCellProps<T> extends Omit<TableHeaderProps<T>, 'headers'> {
  header: Header<T, unknown>;
}

function TableHeaderCell<T>({
  header,
  canResize,
  onResizeStart,
  onToggleSort,
  onNudgeWidth,
}: TableHeaderCellProps<T>) {
  const column = header.column.columnDef.meta as TableColumn<T>;
  const sortDirection = header.column.getIsSorted();
  const headerLabel = flexRender(header.column.columnDef.header, header.getContext());

  const handleResizeKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
    event.preventDefault();
    let lockedWidths: ColumnSizingState | undefined;
    flushSync(() => { lockedWidths = onResizeStart(); });
    onNudgeWidth(
      header.column.id,
      lockedWidths?.[header.column.id] ?? header.getSize(),
      event.key,
      lockedWidths,
    );
  };

  const handleResizeStart = (event: Parameters<ReturnType<typeof header.getResizeHandler>>[0]) => {
    flushSync(onResizeStart);
    header.getResizeHandler()(event);
  };

  return (
    <th
      className={column.className}
      style={{ width: header.getSize() }}
      aria-sort={ariaSortFor(sortDirection)}
    >
      {header.column.getCanSort() ? (
        <button type="button" className="table-sort-trigger" onClick={() => onToggleSort(column)}>
          {headerLabel}
          <span aria-hidden="true" className="table-sort-indicator" data-direction={sortDirection || 'none'} />
        </button>
      ) : headerLabel}
      {header.column.getCanResize() && canResize && (
        <button
          type="button"
          className={`table-resize-handle${header.column.getIsResizing() ? ' table-resize-handle--active' : ''}`}
          aria-label={`Resize ${String(column.header)} column`}
          onMouseDown={handleResizeStart}
          onTouchStart={handleResizeStart}
          onDoubleClick={() => header.column.resetSize()}
          onKeyDown={handleResizeKeyDown}
        />
      )}
    </th>
  );
}

export default function TableHeader<T>({
  headers,
  canResize,
  onResizeStart,
  onToggleSort,
  onNudgeWidth,
}: TableHeaderProps<T>) {
  return (
    <thead>
      <tr>
        {headers.map(header => (
          <TableHeaderCell
            key={header.id}
            header={header}
            canResize={canResize}
            onResizeStart={onResizeStart}
            onToggleSort={onToggleSort}
            onNudgeWidth={onNudgeWidth}
          />
        ))}
      </tr>
    </thead>
  );
}
