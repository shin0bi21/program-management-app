import { useCallback, useState } from 'react';
import type { ColumnSizingState } from '@tanstack/react-table';
import Table, { type TableColumn } from './Table';

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

const columns: TableColumn<StoryRow>[] = [
  { key: 'name', header: 'Name', width: 300, render: row => row.name, resizable: true },
  { key: 'status', header: 'Status', width: 260, render: row => row.status, resizable: true },
  { key: 'notes', header: 'Notes', width: 520, render: row => row.notes, resizable: true },
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
