import tableRefreshMessage from '../../../../../common/components/Table/tableRefreshMessage';
import { useEffect } from 'react';
import Table from '../../../../../common/components/Table/Table';
import usePageMessageReporter, { type PageMessageChangeHandler } from '../../../../../common/components/PageMessageOverlay/usePageMessageReporter';
import type { TableColumnDef } from '../../../../../common/components/Table/Table.types';
import {
  SESSION_TABLE_KEYS,
  type CohortSession,
  type SessionListFilters,
  type SessionSortKey,
} from '../../types';
import type { ListSort } from '../../../../../common/components/Table/Table.types';
import { useSessionTableData } from './hooks/useSessionTableData';

interface SessionTableProps {
  queryKey: readonly unknown[];
  columns: TableColumnDef<CohortSession>[];
  hiddenColumnKeys: string[];
  filters: SessionListFilters;
  sorting: ListSort<SessionSortKey>;
  columnWidths: Record<string, number>;
  selectedSessionId: string;
  onSessionSelect: (session: CohortSession) => void;
  onSortingChange: (sorting: ListSort<SessionSortKey>) => void;
  onColumnWidthsChange: (widths: Record<string, number>) => void;
  onSelectedSessionResolved: (session: CohortSession | null) => void;
  onMessageChange?: PageMessageChangeHandler;
}

export default function SessionTable({
  queryKey, columns, hiddenColumnKeys, filters, sorting, columnWidths, selectedSessionId,
  onSessionSelect, onSortingChange, onColumnWidthsChange, onSelectedSessionResolved, onMessageChange,
}: SessionTableProps) {
  const query = useSessionTableData(queryKey, filters, sorting, true);
  const selectedSession = query.sessions.find(session => session.id === selectedSessionId) ?? null;
  usePageMessageReporter(onMessageChange, query.error || query.nextPageError, { label: 'Retry', onClick: query.nextPageError ? query.retryNextPage : query.retry }, tableRefreshMessage(query.refreshNotice));
  useEffect(() => onSelectedSessionResolved(selectedSession), [onSelectedSessionResolved, selectedSession]);
  const hasFilters = Boolean(filters.search)
    || Boolean(filters.cycleIds?.length)
    || Boolean(filters.programIds?.length)
    || Boolean(filters.sessionTypeIds?.length)
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
