import { fireEvent, render, screen } from '@testing-library/react';
import type { ColumnDef, Header } from '@tanstack/react-table';
import { describe, expect, it, vi } from 'vitest';
import TableHeader from './TableHeader';

interface Row {
  name: string;
}

describe('TableHeader', () => {
  it('resizes a column by one keyboard step from its locked width', () => {
    const column: ColumnDef<Row> = { id: 'name', header: 'Name', cell: ({ row: { original: row } }) => row.name };
    const onResizeByStep = vi.fn();
    const header = {
      id: 'name',
      column: {
        id: 'name',
        columnDef: { header: 'Name', meta: column },
        getCanResize: () => true,
        getCanSort: () => false,
        getIsResizing: () => false,
        getIsSorted: () => false,
        getResizeHandler: () => vi.fn(),
        resetSize: vi.fn(),
      },
      getContext: () => ({}),
      getSize: () => 120,
    } as unknown as Header<Row, unknown>;

    render(<table><TableHeader
      headers={[header]}
      onResizeDrag={vi.fn()}
      onResizeStart={() => ({ name: 180 })}
      onToggleSort={vi.fn()}
      onResizeByStep={onResizeByStep}
    /></table>);

    fireEvent.keyDown(screen.getByRole('button', { name: 'Resize Name column' }), { key: 'ArrowRight' });

    expect(onResizeByStep).toHaveBeenCalledWith('name', 180, 'ArrowRight', { name: 180 });
  });
});
