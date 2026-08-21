import { useCallback, useState } from 'react';
import type { ColumnSizingState } from '@tanstack/react-table';
import Table from './Table';
import type { TableColumnDef } from './Table.types';

interface StoryRow {
  id: string;
  name: string;
  status: string;
  notes: string;
}

function makeRows(start: number, count: number): StoryRow[] {
  return Array.from({ length: count }, (_, index) => {
    const number = start + index;
    return { id: String(number), name: `Person ${number}`, status: number % 2 ? 'Active' : 'Pending', notes: `Notes for row ${number}` };
  });
}

const columns: TableColumnDef<StoryRow>[] = [
  { id: 'name', header: 'Name', size: 300, cell: ({ row: { original: row } }) => row.name, enableResizing: true },
  { id: 'status', header: 'Status', size: 260, cell: ({ row: { original: row } }) => row.status, enableResizing: true },
  { id: 'notes', header: 'Notes', size: 520, cell: ({ row: { original: row } }) => row.notes, enableResizing: true },
];

export function InfiniteScroll() {
  const [rows, setRows] = useState(() => makeRows(1, 30));
  const [loadCount, setLoadCount] = useState(0);
  const [widths, setWidths] = useState<ColumnSizingState>({});
  const loadNextPage = useCallback(() => {
    setLoadCount(current => current + 1);
    setRows(current => current.length >= 60 ? current : [...current, ...makeRows(current.length + 1, 30)]);
  }, []);

  return (
    <div style={{ padding: 24, width: 760 }}>
      <Table
        ariaLabel="Browser-tested infinite table"
        columns={columns}
        data={rows}
        keyExtractor={row => row.id}
        maxHeight="320px"
        hasNextPage={rows.length < 60}
        onLoadNextPage={loadNextPage}
        columnWidths={widths}
        onColumnWidthsChange={setWidths}
      />
      <output data-testid="load-count">{loadCount}</output>
    </div>
  );
}
