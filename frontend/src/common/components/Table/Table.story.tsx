import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import useInfiniteListQuery from '../../../query/hooks/useInfiniteListQuery';
import { useCallback, useRef, useState } from 'react';
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


export function NextPageFailure() {
  const [client] = useState(() => new QueryClient({ defaultOptions: { queries: { retry: false } } }));
  return <QueryClientProvider client={client}><FailingCollection /></QueryClientProvider>;
}

function FailingCollection() {
  const attempts = useRef(0);
  const query = useInfiniteListQuery<StoryRow>({
    queryKey: ['browser-table-failure'],
    errorMessage: 'Could not load rows',
    queryFn: async ({ pageParam }) => {
      if (pageParam === null) return { rows: makeRows(1, 30), nextCursor: 'next' };

      attempts.current += 1;
      if (attempts.current < 3) throw new Error('Could not load more rows');
      return { rows: makeRows(31, 30), nextCursor: null };
    },
  });

  return <div style={{ padding: 24, width: 760 }}>
    <Table ariaLabel="Recoverable table" columns={columns} data={query.rows}
      keyExtractor={row => row.id} maxHeight="320px" loading={query.loading}
      hasNextPage={query.hasNextPage} loadingNextPage={query.loadingNextPage}
      onLoadNextPage={query.loadNextPage}
      nextPageUnavailable={query.nextPageError ? { onRetry: query.retryNextPage } : undefined} />
    <output data-testid="pagination-attempts">{attempts.current}</output>
  </div>;
}
