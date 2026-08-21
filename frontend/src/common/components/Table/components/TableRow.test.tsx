// Scope: verifies TanStack cells and column identity render through a shared table row.
import { render, screen } from '@testing-library/react';
import { getCoreRowModel, useReactTable, type ColumnDef } from '@tanstack/react-table';
import { describe, expect, it, vi } from 'vitest';

import TableRow from './TableRow';

interface Item {
  id: string;
  name: string;
}

function RowHarness() {
  const columns: ColumnDef<Item>[] = [{
    id: 'name',
    cell: ({ row }) => row.original.name.toUpperCase(),
  }];
  const table = useReactTable({
    data: [{ id: 'one', name: 'Avery' }],
    columns,
    getCoreRowModel: getCoreRowModel(),
    getRowId: item => item.id,
  });

  return <table><tbody><TableRow
    row={table.getRowModel().rows[0]}
    selected={false}
    tabbable
    rowIndex={0}
    onNavigate={vi.fn()}
    columnWidths={{ name: 180 }}
  /></tbody></table>;
}

describe('TableRow', () => {
  it('renders the TanStack cell with its column identity and width', () => {
    render(<RowHarness />);

    expect(screen.getByRole('cell', { name: 'AVERY' })).toHaveAttribute('data-column-id', 'name');
    expect(screen.getByRole('cell', { name: 'AVERY' })).toHaveStyle({ width: '180px' });
  });
});
