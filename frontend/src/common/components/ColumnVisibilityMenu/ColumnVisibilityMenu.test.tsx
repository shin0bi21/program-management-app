import { fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import type { TableColumnDef } from '../Table/Table.types';
import ColumnVisibilityMenu from './ColumnVisibilityMenu';

const columns: TableColumnDef<{ name: string; status: string }>[] = [
  { id: 'name', header: 'Name', cell: ({ row }) => row.original.name },
  { id: 'status', header: 'Status', cell: ({ row }) => row.original.status },
  { id: 'actions', header: '', cell: () => 'Actions', enableResizing: false, enableHiding: false },
];

describe('ColumnVisibilityMenu', () => {
  it('changes hideable data columns without exposing fixed action columns', () => {
    const onHiddenColumnKeysChange = vi.fn();
    render(<ColumnVisibilityMenu columns={columns} hiddenColumnKeys={[]} onHiddenColumnKeysChange={onHiddenColumnKeysChange} />);

    fireEvent.click(screen.getByRole('button', { name: 'Columns' }));
    fireEvent.click(screen.getByRole('menuitemcheckbox', { name: 'Status' }));

    expect(onHiddenColumnKeysChange).toHaveBeenCalledWith(['status']);
    expect(screen.queryByRole('menuitemcheckbox', { name: 'Actions' })).not.toBeInTheDocument();
  });

  it('treats hiding and resizing as independent column capabilities', () => {
    const fixedColumns: TableColumnDef<{ name: string }>[] = [
      { id: 'name', header: 'Name', accessorFn: row => row.name, enableResizing: false },
    ];

    render(<ColumnVisibilityMenu columns={fixedColumns} hiddenColumnKeys={[]} onHiddenColumnKeysChange={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Columns' }));

    expect(screen.getByRole('menuitemcheckbox', { name: 'Name' })).toBeInTheDocument();
  });

  it('does not allow the final visible data column to be hidden', () => {
    const onHiddenColumnKeysChange = vi.fn();
    render(<ColumnVisibilityMenu columns={columns} hiddenColumnKeys={['status']} onHiddenColumnKeysChange={onHiddenColumnKeysChange} />);

    fireEvent.click(screen.getByRole('button', { name: 'Columns' }));

    expect(screen.getByRole('menuitemcheckbox', { name: 'Name' })).toBeDisabled();
    expect(onHiddenColumnKeysChange).not.toHaveBeenCalled();
  });

  it('stays open after a selection updates its controlled value', () => {
    function Harness() {
      const [hiddenColumnKeys, setHiddenColumnKeys] = useState<string[]>([]);
      return <ColumnVisibilityMenu columns={columns} hiddenColumnKeys={hiddenColumnKeys} onHiddenColumnKeysChange={setHiddenColumnKeys} />;
    }

    render(<Harness />);
    fireEvent.click(screen.getByRole('button', { name: 'Columns' }));
    fireEvent.click(screen.getByRole('menuitemcheckbox', { name: 'Status' }));

    expect(screen.getByRole('menu')).toBeInTheDocument();
    expect(screen.getByRole('menuitemcheckbox', { name: 'Status' })).toHaveAttribute('aria-checked', 'false');
  });
});
