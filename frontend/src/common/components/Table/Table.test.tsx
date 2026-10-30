import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import Table from './Table';
import type { TableColumnDef } from './Table.types';

interface Row {
  id: string;
  name: string;
}

const columns: TableColumnDef<Row>[] = [
  { id: 'name', header: 'Name', cell: ({ row: { original: row } }) => row.name },
  { id: 'status', header: 'Status', cell: () => 'Active' },
];

describe('Table', () => {
  it('keeps loaded rows with an explicit load-more recovery action', () => {
    const retry = vi.fn();
    render(<Table ariaLabel="Accounts" columns={columns} data={[{ id: 'one', name: 'Avery' }]}
      keyExtractor={row => row.id} nextPageUnavailable={{ onRetry: retry }} />);

    expect(screen.getByText('Avery')).toBeInTheDocument();
    expect(screen.getByText('More rows unavailable')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
    expect(retry).toHaveBeenCalledOnce();
  });

  it('skips unchanged cells during selection and query-state changes', () => {
    const cell = vi.fn(({ row }: { row: { original: Row } }) => row.original.name);
    const stableColumns: TableColumnDef<Row>[] = [{ id: 'name', header: 'Name', cell }];
    const data = [{ id: 'one', name: 'Avery' }, { id: 'two', name: 'Blair' }, { id: 'three', name: 'Casey' }];
    const select = vi.fn();
    const keyExtractor = (row: Row) => row.id;
    const { rerender } = render(<Table ariaLabel="Accounts" columns={stableColumns} data={data}
      keyExtractor={keyExtractor} onRowSelect={select} selectedKey="one" />);
    cell.mockClear();

    rerender(<Table ariaLabel="Accounts" columns={stableColumns} data={data}
      keyExtractor={keyExtractor} onRowSelect={select} selectedKey="two" loadingNextPage />);
    expect(cell.mock.calls.map(([{ row }]) => row.original.id)).toEqual(['one', 'two']);
    cell.mockClear();

    rerender(<Table ariaLabel="Accounts" columns={stableColumns} data={data}
      keyExtractor={keyExtractor} onRowSelect={select} selectedKey="two" refreshing />);
    expect(cell).not.toHaveBeenCalled();
  });

  it('emits controlled backend sorting from sortable headers', () => {
    const onSortingChange = vi.fn();
    const sortableColumns: TableColumnDef<Row>[] = [
      { accessorKey: 'name', header: 'Name' },
    ];
    render(<Table ariaLabel="Accounts" columns={sortableColumns} data={[]} keyExtractor={row => row.id} sorting={{ key: 'name', direction: 'asc' }} sortableColumns={['name']} onSortingChange={onSortingChange} />);

    expect(screen.getByRole('columnheader', { name: /Name/ })).toHaveAttribute('aria-sort', 'ascending');
    fireEvent.click(screen.getByRole('button', { name: 'Name' }));
    expect(onSortingChange).toHaveBeenCalledWith({ key: 'name', direction: 'desc' });
  });

  it('updates visible body cells when hiding columns, while keeping actions available', () => {
    const props = {
      ariaLabel: 'Accounts',
      columns: [
        ...columns,
        { id: 'actions', header: '', cell: () => 'Actions', size: 40, enableResizing: false, enableHiding: false },
      ] satisfies TableColumnDef<Row>[],
      data: [{ id: 'one', name: 'Avery' }],
      keyExtractor: (row: Row) => row.id,
    };
    const { rerender } = render(<Table {...props} />);
    expect(screen.getByRole('cell', { name: 'Active' })).toBeInTheDocument();

    rerender(<Table {...props} hiddenColumnKeys={['status', 'actions']} />);

    expect(screen.queryByRole('columnheader', { name: 'Status' })).not.toBeInTheDocument();
    expect(screen.queryByRole('cell', { name: 'Active' })).not.toBeInTheDocument();
    expect(screen.getAllByRole('columnheader')[1]).toHaveAttribute('data-column-id', 'actions');
    expect(screen.getByText('Actions').closest('td')).toHaveAttribute('data-column-id', 'actions');
  });

  it.each([undefined, false, true])('requires table opt-in and a callback to resize (opt-in: %s)', enabled => {
    const onColumnWidthsChange = enabled === true ? undefined : vi.fn();
    render(<Table ariaLabel="Accounts" columns={columns} data={[]} keyExtractor={row => row.id}
      enableColumnResizing={enabled} columnWidths={{ name: 180 }} onColumnWidthsChange={onColumnWidthsChange} />);

    expect(screen.queryByRole('button', { name: /Resize .* column/ })).not.toBeInTheDocument();
    expect(screen.getByRole('table').querySelector('col')).toHaveStyle({ width: '180px' });
  });

  it('keeps fixed columns disabled and cancels an active drag when table resizing is turned off', () => {
    const onColumnWidthsChange = vi.fn();
    const props = {
      ariaLabel: 'Accounts', data: [], keyExtractor: (row: Row) => row.id, onColumnWidthsChange,
      columns: [...columns, { id: 'actions', header: '', enableResizing: false }] satisfies TableColumnDef<Row>[],
    };
    const { rerender, container } = render(<Table {...props} enableColumnResizing />);
    expect(screen.queryByRole('button', { name: 'Resize  column' })).not.toBeInTheDocument();
    fireEvent.mouseDown(screen.getByRole('button', { name: 'Resize Name column' }), { clientX: 150 });
    fireEvent.mouseMove(document, { clientX: 180 });
    expect(container.querySelector('.table-resize-guide')).toBeInTheDocument();

    rerender(<Table {...props} enableColumnResizing={false} />);
    fireEvent.mouseUp(document, { clientX: 180 });

    expect(onColumnWidthsChange).not.toHaveBeenCalled();
    expect(container.querySelector('.table-resize-guide')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Resize .* column/ })).not.toBeInTheDocument();
  });

  it('captures visible widths and preserves hidden preferences in one release callback', () => {
    const onColumnWidthsChange = vi.fn();
    render(<Table ariaLabel="Accounts" columns={[
      ...columns,
      { id: 'hidden', header: 'Hidden', cell: () => null },
      { id: 'actions', header: '', size: 40, enableResizing: false, cell: () => null },
    ]} data={[]} keyExtractor={row => row.id} hiddenColumnKeys={['hidden']}
      columnWidths={{ name: 150, status: 150, hidden: 240 }} enableColumnResizing onColumnWidthsChange={onColumnWidthsChange} />);
    const headers = screen.getAllByRole('columnheader');
    vi.spyOn(headers[0], 'getBoundingClientRect').mockReturnValue({ left: 0, width: 320.25 } as DOMRect);
    vi.spyOn(headers[1], 'getBoundingClientRect').mockReturnValue({ left: 320.25, width: 280.5 } as DOMRect);

    fireEvent.mouseDown(screen.getByRole('button', { name: 'Resize Status column' }), { clientX: 600 });
    fireEvent.mouseMove(document, { clientX: 650 });
    expect(onColumnWidthsChange).not.toHaveBeenCalled();
    fireEvent.mouseUp(document, { clientX: 650 });

    expect(onColumnWidthsChange).toHaveBeenCalledExactlyOnceWith({ name: 320.25, status: 330.5, hidden: 240 });
  });

  it('does not rerender cells across three loaded pages during a drag', () => {
    const cell = vi.fn(({ row }: { row: { original: Row } }) => row.original.name);
    const data = Array.from({ length: 150 }, (_, index) => ({ id: String(index), name: `Row ${index}` }));
    const onColumnWidthsChange = vi.fn();
    render(<Table ariaLabel="Accounts" columns={[{ id: 'name', header: 'Name', cell }]}
      data={data} keyExtractor={row => row.id} columnWidths={{ name: 150 }}
      enableColumnResizing onColumnWidthsChange={onColumnWidthsChange} />);
    expect(cell).toHaveBeenCalledTimes(150);
    cell.mockClear();

    fireEvent.mouseDown(screen.getByRole('button', { name: 'Resize Name column' }), { clientX: 150 });
    for (let clientX = 160; clientX <= 250; clientX += 10) fireEvent.mouseMove(document, { clientX });

    expect(cell).not.toHaveBeenCalled();
    expect(onColumnWidthsChange).not.toHaveBeenCalled();
    fireEvent.mouseUp(document, { clientX: 250 });
    expect(onColumnWidthsChange).toHaveBeenCalledExactlyOnceWith({ name: 250 });
  });

  it('keeps the header and renders a full-width row when data is empty', () => {
    render(<Table ariaLabel="Accounts" columns={columns} data={[]} keyExtractor={row => row.id} emptyMessage="No accounts found" />);

    expect(screen.getByRole('table', { name: 'Accounts' })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'Name' })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'Status' })).toBeInTheDocument();
    const emptyCell = screen.getByRole('cell', { name: 'No accounts found' });
    expect(emptyCell).toHaveAttribute('colspan', '2');
    expect(emptyCell.closest('tr')).toHaveClass('table-empty-row');
  });

  it('uses the shared empty-row message by default', () => {
    render(<Table ariaLabel="Accounts" columns={columns} data={[]} keyExtractor={row => row.id} />);
    expect(screen.getByRole('cell', { name: 'No rows found' })).toBeInTheDocument();
  });

  it('keeps the header mounted while only the table body is loading', () => {
    render(<Table ariaLabel="Accounts" columns={columns} data={[]} loading keyExtractor={row => row.id} />);

    expect(screen.getByRole('columnheader', { name: 'Name' })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'Status' })).toBeInTheDocument();
    expect(screen.getByRole('status', { name: 'Loading rows' })).toBeInTheDocument();
  });

  it('keeps the header and renders the shared unavailable state with retry', () => {
    const onRetry = vi.fn();
    render(<Table
      ariaLabel="Accounts"
      columns={columns}
      data={[]}
      unavailable={{ title: 'Accounts unavailable', message: 'Unable to load accounts', onRetry }}
      keyExtractor={row => row.id}
    />);

    expect(screen.getByRole('columnheader', { name: 'Name' })).toBeInTheDocument();
    expect(screen.getByText('Accounts unavailable')).toBeInTheDocument();
    expect(screen.getByText('Unable to load accounts')).toBeInTheDocument();
    expect(screen.queryByText('No rows found')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
    expect(onRetry).toHaveBeenCalledOnce();
  });

  it('keeps existing error consumers compatible during unavailable-state adoption', () => {
    render(<Table
      ariaLabel="Accounts"
      columns={columns}
      data={[]}
      error="Unable to load accounts"
      keyExtractor={row => row.id}
    />);

    expect(screen.getByRole('columnheader', { name: 'Name' })).toBeInTheDocument();
    expect(screen.getByText('Content unavailable')).toBeInTheDocument();
    expect(screen.getByText('Unable to load accounts')).toBeInTheDocument();
  });

  it('keeps existing rows mounted and shows a sorting spinner while refreshing', () => {
    render(<Table
      ariaLabel="Accounts"
      columns={columns}
      data={[{ id: '1', name: 'Jamie' }]}
      refreshing
      keyExtractor={row => row.id}
    />);

    const existingRow = screen.getByRole('row', { name: /Jamie Active/ });
    expect(existingRow).toBeInTheDocument();
    expect(screen.getByRole('status', { name: 'Updating rows' })).toBeInTheDocument();
    expect(existingRow.closest('tbody')).toHaveAttribute('inert');
    expect(screen.queryByRole('status', { name: 'Loading rows' })).not.toBeInTheDocument();
  });

  it('supports mouse and keyboard row selection', () => {
    const onSelect = vi.fn();
    render(<Table ariaLabel="Accounts" columns={columns} data={[{ id: '1', name: 'Jamie' }]} keyExtractor={row => row.id} selectedKey="1" onRowSelect={onSelect} />);

    const row = screen.getByRole('row', { name: /Jamie Active/ });
    expect(row).toHaveAttribute('aria-selected', 'true');
    fireEvent.click(row);
    fireEvent.keyDown(row, { key: 'Enter' });
    expect(onSelect).toHaveBeenCalledTimes(2);
  });

  it('wires row-key navigation to shared table selection and focus', () => {
    const onSelect = vi.fn();
    render(<Table
      ariaLabel="Accounts"
      columns={columns}
      data={[
        { id: '1', name: 'First' },
        { id: '2', name: 'Second' },
        { id: '3', name: 'Third' },
      ]}
      keyExtractor={row => row.id}
      selectedKey="1"
      onRowSelect={onSelect}
    />);

    const first = screen.getByRole('row', { name: /First Active/ });
    const second = screen.getByRole('row', { name: /Second Active/ });
    first.focus();
    fireEvent.keyDown(first, { key: 'ArrowDown' });
    expect(onSelect).toHaveBeenLastCalledWith(expect.objectContaining({ id: '2' }));
    expect(second).toHaveFocus();
  });

  it('does not select a row when an interactive control is clicked', () => {
    const onSelect = vi.fn();
    const onAction = vi.fn();
    const columnsWithAction: TableColumnDef<Row>[] = [
      ...columns,
      { id: 'action', header: '', cell: () => <button onClick={onAction}>More actions</button> },
    ];
    render(<Table ariaLabel="Accounts" columns={columnsWithAction} data={[{ id: '1', name: 'Jamie' }]} keyExtractor={row => row.id} onRowSelect={onSelect} />);

    fireEvent.click(screen.getByRole('button', { name: 'More actions' }));

    expect(onAction).toHaveBeenCalledOnce();
    expect(onSelect).not.toHaveBeenCalled();
  });
});
