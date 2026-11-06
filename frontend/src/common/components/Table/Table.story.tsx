import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import useInfiniteListQuery from '../../../query/hooks/useInfiniteListQuery';
import { useCallback, useRef, useState } from 'react';
import type { ColumnSizingState } from '@tanstack/react-table';
import Table from './Table';
import '../PageContainer/PageContainer.css';
import type { TableColumnDef } from './Table.types';

interface StoryRow {
  id: string;
  name: string;
  status: string;
  notes: string;
}

const columns: TableColumnDef<StoryRow>[] = [
  { id: 'name', header: 'Name', size: 300, cell: ({ row: { original: row } }) => row.name, enableResizing: true },
  { id: 'status', header: 'Status', size: 260, cell: ({ row: { original: row } }) => row.status, enableResizing: true },
  { id: 'notes', header: 'Notes', size: 520, cell: ({ row: { original: row } }) => row.notes, enableResizing: true },
];

/**
 * Displays 30 people and adds another 30 when the table requests its next page.
 * @example Scrolling to the bottom increases the displayed load count and reveals Person 60.
 */
export function InfiniteScroll() {
  const [rows, setRows] = useState(() => makeRows(1, 30));
  const [loadCount, setLoadCount] = useState(0);
  const [widths, setWidths] = useState<ColumnSizingState>({});

  /**
   * Appends the second page once and counts every pagination request.
   * @example The first call grows 30 rows to 60; later calls retain those 60.
   */
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
        enableColumnResizing
        onColumnWidthsChange={setWidths}
      />
      <output data-testid="load-count">{loadCount}</output>
    </div>
  );
}

/**
 * Displays a table whose second page fails twice before Retry can recover it.
 * @example Failed pagination leaves the first 30 people visible.
 */
export function NextPageFailure() {
  const [client] = useState(() => new QueryClient({ defaultOptions: { queries: { retry: false } } }));
  return <QueryClientProvider client={client}><FailingCollection /></QueryClientProvider>;
}

/**
 * Supplies the failed-page story with 30 initial rows and a recoverable next-page request.
 * Requires its isolated QueryClientProvider.
 * @example The third second-page attempt succeeds and adds people 31–60.
 */
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

/**
 * Shows initial table loading in a fixed-height area, then replaces it with two people.
 * @example Finish loading removes the spinner without changing the table area's height.
 */
export function InitialLoading() {
  const [loaded, setLoaded] = useState(false);
  return <div style={{ height: 480, display: 'flex', flexDirection: 'column' }}>
    <button onClick={() => setLoaded(true)}>Finish loading</button>
    <div className="page-table" role="region" aria-label="Loading table area">
      <Table ariaLabel="Loading example" columns={columns.slice(0, 1)}
        data={loaded ? makeRows(1, 2) : []} loading={!loaded} keyExtractor={row => row.id} />
    </div>
  </div>;
}

const resizeColumns: TableColumnDef<StoryRow>[] = [
  { id: 'name', header: 'Name', size: 180, cell: ({ row }) => row.original.name },
  { id: 'status', header: 'Status', size: 180, cell: ({ row }) => row.original.status },
  { id: 'notes', header: 'Notes', size: 280, cell: ({ row }) => row.original.notes },
  { id: 'actions', header: '', size: 40, enableResizing: false, enableHiding: false, cell: () => '…' },
];
const resizeRows = makeRows(1, 100);

/**
 * Displays a resizable table with controls for narrowing its area and hiding Notes.
 * @example A completed resize increments the commit count once and displays the saved widths.
 */
export function ResizePreview() {
  const [widths, setWidths] = useState<ColumnSizingState>({ notes: 280 });
  const [commits, setCommits] = useState(0);
  const [narrow, setNarrow] = useState(false);
  const [hiddenColumnKeys, setHiddenColumnKeys] = useState<string[]>([]);

  return <div style={{ padding: 24, width: narrow ? 540 : 820 }}>
    <button onClick={() => setNarrow(value => !value)}>Toggle viewport width</button>
    <button onClick={() => setHiddenColumnKeys(value => value.length ? [] : ['notes'])}>Toggle notes</button>
    <Table ariaLabel="Resize preview table" columns={resizeColumns} data={resizeRows}
      keyExtractor={row => row.id} maxHeight="320px" selectedKey="1"
      hiddenColumnKeys={hiddenColumnKeys} columnWidths={widths}
      enableColumnResizing
      onColumnWidthsChange={next => {
        setCommits(value => value + 1);
        setWidths(next);
      }} />
    <output data-testid="resize-commits">{commits}</output>
    <output data-testid="saved-widths">{JSON.stringify(widths)}</output>
  </div>;
}

/**
 * Creates consecutive people with alternating Active/Pending statuses and numbered notes.
 * @param start - Positive whole number used for the first person's ID and name.
 * @param count - Non-negative whole number of people to create.
 * @example makeRows(1, 2) creates Person 1 (Active) and Person 2 (Pending).
 */
function makeRows(start: number, count: number): StoryRow[] {
  return Array.from({ length: count }, (_, index) => {
    const number = start + index;

    return {
      id: String(number),
      name: `Person ${number}`,
      status: number % 2 ? 'Active' : 'Pending',
      notes: `Notes for row ${number}`,
    };
  });
}
