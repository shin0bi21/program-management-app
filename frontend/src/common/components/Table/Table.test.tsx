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
