import { useState } from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import Table, { type TableColumn } from './Table';

interface Row {
  id: string;
  name: string;
}

const columns: TableColumn<Row>[] = [
  { key: 'name', header: 'Name', render: row => row.name },
  { key: 'status', header: 'Status', render: () => 'Active' },
];

describe('Table', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('emits controlled backend sorting from sortable headers', () => {
    const onSortingChange = vi.fn();
    const sortableColumns: TableColumn<Row>[] = [
      { key: 'name', sortKey: 'name', header: 'Name', render: row => row.name },
    ];
    render(<Table ariaLabel="Accounts" columns={sortableColumns} data={[]} keyExtractor={row => row.id} sorting={{ key: 'name', direction: 'asc' }} onSortingChange={onSortingChange} />);

    expect(screen.getByRole('columnheader', { name: /Name/ })).toHaveAttribute('aria-sort', 'ascending');
    fireEvent.click(screen.getByRole('button', { name: 'Name' }));
    expect(onSortingChange).toHaveBeenCalledWith({ key: 'name', direction: 'desc' });
  });

  it('omits hidden data columns but keeps fixed action columns available', () => {
    render(<Table
      ariaLabel="Accounts"
      columns={[
        ...columns,
        { key: 'actions', header: '', render: () => 'Actions', width: 40, resizable: false },
      ]}
      data={[{ id: 'one', name: 'Avery' }]}
      keyExtractor={row => row.id}
      hiddenColumnKeys={['status', 'actions']}
    />);

    expect(screen.queryByRole('columnheader', { name: 'Status' })).not.toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'Name' })).toBeInTheDocument();
    expect(screen.getByText('Actions')).toBeInTheDocument();
  });

  it('resizes data columns by keyboard while leaving action columns fixed', () => {
    const onColumnWidthsChange = vi.fn();
    const resizableColumns: TableColumn<Row>[] = [
      { key: 'name', header: 'Name', render: row => row.name },
      { key: 'actions', header: '', render: () => null, width: 40, resizable: false },
    ];
    render(<Table
      ariaLabel="Accounts"
      columns={resizableColumns}
      data={[]}
      keyExtractor={row => row.id}
      columnWidths={{ name: 150 }}
      onColumnWidthsChange={onColumnWidthsChange}
    />);

    fireEvent.keyDown(screen.getByRole('button', { name: 'Resize Name column' }), { key: 'ArrowRight' });
    expect(onColumnWidthsChange).toHaveBeenCalledWith({ name: 160 });
    expect(screen.queryByRole('button', { name: 'Resize  column' })).not.toBeInTheDocument();
    expect(screen.getByRole('table', { name: 'Accounts' })).toHaveStyle({ width: '100%', minWidth: '190px' });
    expect(screen.getByRole('columnheader', { name: 'Name' })).toHaveStyle({ width: '150px' });
    expect(screen.getAllByRole('columnheader')[1]).toHaveStyle({ width: '40px' });
    const tracks = screen.getByRole('table', { name: 'Accounts' }).querySelectorAll('col');
    expect(tracks[0]).toHaveStyle({ width: '150px' });
    expect(tracks[1]).toHaveStyle({ width: '40px' });
  });

  it('locks sibling pixel widths while the active column grows from its right edge', () => {
    const onWidthsChange = vi.fn();
    const resizeColumns: TableColumn<Row>[] = [
      { key: 'name', header: 'Name', render: row => row.name },
      { key: 'status', header: 'Status', render: () => 'Active' },
      { key: 'actions', header: '', render: () => null, width: 40, resizable: false },
    ];

    function ControlledTable() {
      const [widths, setWidths] = useState({ name: 150, status: 150 });
      return (
        <Table
          ariaLabel="Accounts"
          columns={resizeColumns}
          data={[]}
          keyExtractor={row => row.id}
          columnWidths={widths}
          onColumnWidthsChange={next => {
            onWidthsChange(next);
            setWidths(next as typeof widths);
          }}
        />
      );
    }

    render(<ControlledTable />);
    const nameHeader = screen.getByRole('columnheader', { name: 'Name' });
    const statusHeader = screen.getByRole('columnheader', { name: 'Status' });
    vi.spyOn(nameHeader, 'getBoundingClientRect').mockReturnValue({ width: 320 } as DOMRect);
    vi.spyOn(statusHeader, 'getBoundingClientRect').mockReturnValue({ width: 280 } as DOMRect);

    fireEvent.mouseDown(screen.getByRole('button', { name: 'Resize Status column' }), { clientX: 600 });
    fireEvent.mouseMove(document, { clientX: 650 });
    fireEvent.mouseUp(document);

    expect(onWidthsChange).toHaveBeenNthCalledWith(1, { name: 320, status: 280 });
    expect(onWidthsChange).toHaveBeenLastCalledWith({ name: 320, status: 330 });
    expect(nameHeader).toHaveStyle({ width: '320px' });
    expect(statusHeader).toHaveStyle({ width: '330px' });
    expect(screen.getAllByRole('columnheader')[2]).toHaveStyle({ width: '40px' });
  });

  it('preserves captured sibling widths during keyboard resizing', () => {
    const onColumnWidthsChange = vi.fn();
    render(<Table
      ariaLabel="Accounts"
      columns={columns}
      data={[]}
      keyExtractor={row => row.id}
      columnWidths={{ name: 150, status: 150 }}
      onColumnWidthsChange={onColumnWidthsChange}
    />);
    const nameHeader = screen.getByRole('columnheader', { name: 'Name' });
    const statusHeader = screen.getByRole('columnheader', { name: 'Status' });
    vi.spyOn(nameHeader, 'getBoundingClientRect').mockReturnValue({ width: 320 } as DOMRect);
    vi.spyOn(statusHeader, 'getBoundingClientRect').mockReturnValue({ width: 280 } as DOMRect);

    fireEvent.keyDown(screen.getByRole('button', { name: 'Resize Status column' }), { key: 'ArrowRight' });

    expect(onColumnWidthsChange).toHaveBeenNthCalledWith(1, { name: 320, status: 280 });
    expect(onColumnWidthsChange).toHaveBeenLastCalledWith({ name: 320, status: 290 });
  });

  it('preserves hidden column widths while a visible column is resized', () => {
    const onWidthsChange = vi.fn();

    function ControlledTable() {
      const [widths, setWidths] = useState({ name: 150, status: 240 });
      const [hiddenColumnKeys, setHiddenColumnKeys] = useState(['status']);

      return <>
        <button type="button" onClick={() => setHiddenColumnKeys([])}>Show status</button>
        <Table
          ariaLabel="Accounts"
          columns={columns}
          data={[]}
          keyExtractor={row => row.id}
          hiddenColumnKeys={hiddenColumnKeys}
          columnWidths={widths}
          onColumnWidthsChange={next => {
            onWidthsChange(next);
            setWidths(next as typeof widths);
          }}
        />
      </>;
    }

    render(<ControlledTable />);
    const nameHeader = screen.getByRole('columnheader', { name: 'Name' });
    vi.spyOn(nameHeader, 'getBoundingClientRect').mockReturnValue({ width: 150 } as DOMRect);

    fireEvent.mouseDown(screen.getByRole('button', { name: 'Resize Name column' }), { clientX: 150 });
    fireEvent.mouseMove(document, { clientX: 170 });
    fireEvent.mouseUp(document);

    expect(onWidthsChange).toHaveBeenLastCalledWith({ name: 170, status: 240 });
    fireEvent.click(screen.getByRole('button', { name: 'Show status' }));
    expect(screen.getByRole('columnheader', { name: 'Status' })).toHaveStyle({ width: '240px' });
  });

  it('clamps transient drag widths before exposing them to preference persistence', () => {
    const onColumnWidthsChange = vi.fn();
    const dragColumns: TableColumn<Row>[] = [
      { key: 'name', header: 'Name', render: row => row.name },
    ];
    render(<Table
      ariaLabel="Accounts"
      columns={dragColumns}
      data={[]}
      keyExtractor={row => row.id}
      columnWidths={{ name: 150 }}
      onColumnWidthsChange={onColumnWidthsChange}
    />);

    fireEvent.mouseDown(screen.getByRole('button', { name: 'Resize Name column' }), { clientX: 150 });
    fireEvent.mouseMove(document, { clientX: 0 });
    fireEvent.mouseUp(document);

    expect(onColumnWidthsChange).toHaveBeenCalled();
    expect(onColumnWidthsChange.mock.calls.every(([widths]) => widths.name >= 100)).toBe(true);
  });

  it('loads the next batch when the scroll sentinel intersects', () => {
    let notify: IntersectionObserverCallback | undefined;
    const disconnect = vi.fn();
    vi.stubGlobal('IntersectionObserver', vi.fn(function (callback: IntersectionObserverCallback) {
      notify = callback;
      return { observe: vi.fn(), disconnect, unobserve: vi.fn(), takeRecords: vi.fn(), root: null, rootMargin: '', thresholds: [] };
    }));
    const onLoadNextPage = vi.fn();
    const { unmount } = render(<Table ariaLabel="Accounts" columns={columns} data={[{ id: '1', name: 'Jamie' }]} keyExtractor={row => row.id} hasNextPage onLoadNextPage={onLoadNextPage} />);

    notify?.([{ isIntersecting: true } as IntersectionObserverEntry], {} as IntersectionObserver);
    expect(onLoadNextPage).toHaveBeenCalledOnce();
    unmount();
    expect(disconnect).toHaveBeenCalledOnce();
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
    const loadingCell = screen.getByRole('cell', { name: 'Loading...' });
    expect(loadingCell).toHaveAttribute('colspan', '2');
    expect(loadingCell.closest('tr')).toHaveClass('table-loading-row');
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
    expect(screen.queryByRole('cell', { name: 'Loading...' })).not.toBeInTheDocument();
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

  it('does not scroll back to the selected row when another page is appended', () => {
    const scrollIntoView = vi.fn();
    Element.prototype.scrollIntoView = scrollIntoView;
    const firstPage = [{ id: '1', name: 'First' }];
    const { rerender } = render(<Table
      ariaLabel="Accounts"
      columns={columns}
      data={firstPage}
      keyExtractor={row => row.id}
      selectedKey="1"
      scrollToSelected
    />);

    expect(scrollIntoView).toHaveBeenCalledOnce();
    rerender(<Table
      ariaLabel="Accounts"
      columns={columns}
      data={[...firstPage, { id: '2', name: 'Second' }]}
      keyExtractor={row => row.id}
      selectedKey="1"
      scrollToSelected
    />);

    expect(scrollIntoView).toHaveBeenCalledOnce();
  });

  it('moves row focus and selection with arrow, Home, and End keys', () => {
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
    const third = screen.getByRole('row', { name: /Third Active/ });

    first.focus();
    fireEvent.keyDown(first, { key: 'ArrowDown' });
    expect(onSelect).toHaveBeenLastCalledWith(expect.objectContaining({ id: '2' }));
    expect(second).toHaveFocus();

    fireEvent.keyDown(second, { key: 'End' });
    expect(onSelect).toHaveBeenLastCalledWith(expect.objectContaining({ id: '3' }));
    expect(third).toHaveFocus();

    fireEvent.keyDown(third, { key: 'Home' });
    expect(onSelect).toHaveBeenLastCalledWith(expect.objectContaining({ id: '1' }));
    expect(first).toHaveFocus();
  });

  it('provides arrow-key row navigation without making rows selectable', () => {
    render(<Table
      ariaLabel="Accounts"
      columns={columns}
      data={[
        { id: '1', name: 'First' },
        { id: '2', name: 'Second' },
      ]}
      keyExtractor={row => row.id}
    />);

    const first = screen.getByRole('row', { name: /First Active/ });
    const second = screen.getByRole('row', { name: /Second Active/ });

    expect(first).toHaveAttribute('tabindex', '0');
    expect(first).not.toHaveClass('table-row--selectable');
    first.focus();
    fireEvent.keyDown(first, { key: 'ArrowDown' });
    expect(second).toHaveFocus();
    fireEvent.keyDown(second, { key: 'ArrowUp' });
    expect(first).toHaveFocus();
  });

  it('does not select a row when an interactive control is clicked', () => {
    const onSelect = vi.fn();
    const onAction = vi.fn();
    const columnsWithAction: TableColumn<Row>[] = [
      ...columns,
      { key: 'action', header: '', render: () => <button onClick={onAction}>More actions</button> },
    ];
    render(<Table ariaLabel="Accounts" columns={columnsWithAction} data={[{ id: '1', name: 'Jamie' }]} keyExtractor={row => row.id} onRowSelect={onSelect} />);

    fireEvent.click(screen.getByRole('button', { name: 'More actions' }));

    expect(onAction).toHaveBeenCalledOnce();
    expect(onSelect).not.toHaveBeenCalled();
  });

  it('renders fetch errors inside the table while preserving its header', () => {
    render(<Table
      ariaLabel="Accounts"
      columns={columns}
      data={[]}
      error="Unable to load accounts"
      keyExtractor={row => row.id}
    />);

    expect(screen.getByRole('columnheader', { name: 'Name' })).toBeInTheDocument();
    expect(screen.getByRole('cell', { name: 'Unable to load accounts' })).toHaveClass('table-error-cell');
  });
});
