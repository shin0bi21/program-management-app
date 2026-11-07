import tableRefreshMessage from '../../../../../common/components/Table/tableRefreshMessage';
import Table from '../../../../../common/components/Table/Table';
import usePageMessageReporter, { type PageMessageChangeHandler } from '../../../../../common/components/PageMessageOverlay/usePageMessageReporter';
import type { TableColumnDef } from '../../../../../common/components/Table/Table.types';
import {
  SESSION_TABLE_KEYS,
  type ProgramSession,
  type SessionListFilters,
  type SessionSortKey,
} from '../../types';
import type { ListSort } from '../../../../../common/components/Table/Table.types';
import { useSessionTableData } from './hooks/useSessionTableData';

interface SessionTableProps {
  queryKey: readonly unknown[];
  columns: TableColumnDef<ProgramSession>[];
  hiddenColumnKeys: string[];
  filters: SessionListFilters;
  sorting: ListSort<SessionSortKey>;
  columnWidths: Record<string, number>;
  selectedSessionId: string;
  onSessionSelect: (session: ProgramSession) => void;
  onSortingChange: (sorting: ListSort<SessionSortKey>) => void;
  onColumnWidthsChange: (widths: Record<string, number>) => void;
  onMessageChange?: PageMessageChangeHandler;
}

/**
 * Displays paginated shared session records and reports view failures.
 * @example <SessionTable filters={filters} {...viewProps} />
 */
export default function SessionTable({
  queryKey, columns, hiddenColumnKeys, filters, sorting, columnWidths, selectedSessionId,
  onSessionSelect, onSortingChange, onColumnWidthsChange, onMessageChange,
}: SessionTableProps) {
  const query = useSessionTableData(queryKey, filters, sorting, true);
  usePageMessageReporter(onMessageChange, query.error || query.nextPageError, { label: 'Retry', onClick: query.nextPageError ? query.retryNextPage : query.retry }, tableRefreshMessage(query.refreshNotice));
  const hasFilters = Boolean(filters.search)
    || Boolean(filters.cycleIds?.length)
    || Boolean(filters.programIds?.length)
    || Boolean(filters.sessionTypes?.length)
    || Boolean(filters.statuses?.length);

  return <Table
    enableColumnResizing
    ariaLabel="Sessions"
    columns={columns}
    hiddenColumnKeys={hiddenColumnKeys}
    data={query.sessions}
    loading={query.loading}
    refreshing={query.refreshing}
    unavailable={query.error && !query.sessions.length ? { title: 'Sessions unavailable', onRetry: query.retry } : undefined}
    emptyMessage={hasFilters ? 'No sessions match your search and filters' : 'No sessions yet'}
    keyExtractor={session => session.id}
    selectedKey={selectedSessionId || null}
    scrollToSelected={Boolean(selectedSessionId)}
    onRowSelect={onSessionSelect}
    sorting={sorting}
    sortableColumns={SESSION_TABLE_KEYS}
    onSortingChange={next => onSortingChange(next as ListSort<SessionSortKey>)}
    columnWidths={columnWidths}
    onColumnWidthsChange={onColumnWidthsChange}
    hasNextPage={query.hasNextPage}
    loadingNextPage={query.loadingNextPage}
    nextPageUnavailable={query.nextPageError ? { onRetry: query.retryNextPage } : undefined}
    onLoadNextPage={query.loadNextPage}
  />;
}
