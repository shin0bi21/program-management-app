import { useEffect } from 'react';
import Table from '../../../../../common/components/Table/Table';
import usePageErrorReporter, { type PageErrorChangeHandler } from '../../../../../common/components/PageErrorOverlay/usePageErrorReporter';
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
  onErrorChange?: PageErrorChangeHandler;
}

export default function SessionTable({
  queryKey, columns, hiddenColumnKeys, filters, sorting, columnWidths, selectedSessionId,
  onSessionSelect, onSortingChange, onColumnWidthsChange, onSelectedSessionResolved, onErrorChange,
}: SessionTableProps) {
  const query = useSessionTableData(queryKey, filters, sorting, true);
  const selectedSession = query.sessions.find(session => session.id === selectedSessionId) ?? null;
  usePageErrorReporter(onErrorChange, query.error, { label: 'Retry', onClick: query.retry });
  useEffect(() => onSelectedSessionResolved(selectedSession), [onSelectedSessionResolved, selectedSession]);
  const hasFilters = Boolean(filters.search)
    || Boolean(filters.cycleId)
    || Boolean(filters.programIds?.length)
    || Boolean(filters.sessionTypeIds?.length)
    || Boolean(filters.statuses?.length);

  return <Table
    ariaLabel="Sessions"
    columns={columns}
    hiddenColumnKeys={hiddenColumnKeys}
    data={query.sessions}
    loading={query.loading}
    refreshing={query.refreshing}
    unavailable={query.error ? { title: 'Sessions unavailable', onRetry: query.retry } : undefined}
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
    onLoadNextPage={query.loadNextPage}
  />;
}
