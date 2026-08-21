// Scope: verifies the shared table's flat, stable, string-header column contract.
import type { ColumnDef } from '@tanstack/react-table';
import { describe, expect, it } from 'vitest';

import { getTableColumnId, type TableColumnDef } from './Table.types';

interface Row {
  id: string;
  name: string;
}

const idColumn: TableColumnDef<Row> = { id: 'name', header: 'Name' };
const accessorColumn: TableColumnDef<Row> = { accessorKey: 'name', header: 'Name' };

describe('TableColumnDef', () => {
  it('accepts stable ids and accessor keys', () => {
    expect(getTableColumnId(idColumn)).toBe('name');
    expect(getTableColumnId(accessorColumn)).toBe('name');
  });

  it('rejects grouped TanStack columns at the runtime boundary', () => {
    const groupedColumn: ColumnDef<Row> = {
      header: 'Person',
      columns: [{ accessorKey: 'name', header: 'Name' }],
    };

    expect(() => getTableColumnId(groupedColumn)).toThrow(
      'Table columns must be flat; grouped columns are not supported',
    );
  });
});

// @ts-expect-error Nested TanStack column groups are outside the shared Table contract.
const groupedColumn: TableColumnDef<Row> = { id: 'person', header: 'Person', columns: [idColumn] };
void groupedColumn;

// @ts-expect-error Shared Table headers must be strings for visibility and resize labels.
const functionalHeader: TableColumnDef<Row> = { id: 'name', header: () => 'Name' };
void functionalHeader;

// @ts-expect-error Shared Table columns require a stable id or accessorKey.
const unidentifiedColumn: TableColumnDef<Row> = { header: 'Name' };
void unidentifiedColumn;
