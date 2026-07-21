import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
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
  it('keeps the header and renders a full-width row when data is empty', () => {
    render(<Table columns={columns} data={[]} keyExtractor={row => row.id} emptyMessage="No accounts found" />);

    expect(screen.getByRole('columnheader', { name: 'Name' })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'Status' })).toBeInTheDocument();
    const emptyCell = screen.getByRole('cell', { name: 'No accounts found' });
    expect(emptyCell).toHaveAttribute('colspan', '2');
    expect(emptyCell.closest('tr')).toHaveClass('table-empty-row');
  });

  it('uses the shared empty-row message by default', () => {
    render(<Table columns={columns} data={[]} keyExtractor={row => row.id} />);
    expect(screen.getByRole('cell', { name: 'No rows found' })).toBeInTheDocument();
  });

  it('keeps the header mounted while only the table body is loading', () => {
    render(<Table columns={columns} data={[]} loading keyExtractor={row => row.id} />);

    expect(screen.getByRole('columnheader', { name: 'Name' })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'Status' })).toBeInTheDocument();
    const loadingCell = screen.getByRole('cell', { name: 'Loading...' });
    expect(loadingCell).toHaveAttribute('colspan', '2');
    expect(loadingCell.closest('tr')).toHaveClass('table-loading-row');
  });
});
