import { useEffect } from 'react';
import Table, { type TableColumn } from '../../../../../common/components/Table/Table';
import type { CohortSession, SessionListFilters, SessionSortKey } from '../../../../../common/types/cohort';
import type { ListSort } from '../../../../../common/types/pagination';
import { useSessions } from './hooks/useSessions';

export interface SessionListMutationCache {
  remove: (id: string) => void;
  refresh: () => Promise<unknown>;
}

interface SessionListViewProps {
  columns: TableColumn<CohortSession>[];
  hiddenColumnKeys: string[];
  filters: SessionListFilters;
  sorting: ListSort<SessionSortKey>;
  columnWidths: Record<string, number>;
  selectedSessionId: string;
  onSessionSelect: (session: CohortSession) => void;
  onSortingChange: (sorting: ListSort<SessionSortKey>) => void;
  onColumnWidthsChange: (widths: Record<string, number>) => void;
  mutationCacheRef: React.MutableRefObject<SessionListMutationCache>;
  onSelectedSessionResolved: (session: CohortSession | null) => void;
}

export default function SessionListView({
  columns, hiddenColumnKeys, filters, sorting, columnWidths, selectedSessionId,
  onSessionSelect, onSortingChange, onColumnWidthsChange, mutationCacheRef, onSelectedSessionResolved,
}: SessionListViewProps) {
  const query = useSessions(filters, sorting, true);
  useEffect(() => {
    mutationCacheRef.current = { remove: query.removeSession, refresh: query.refresh };
    return () => { mutationCacheRef.current = { remove: () => undefined, refresh: async () => undefined }; };
  }, [mutationCacheRef, query.refresh, query.removeSession]);
  const selectedSession = query.sessions.find(session => session.id === selectedSessionId) ?? null;
  useEffect(() => onSelectedSessionResolved(selectedSession), [onSelectedSessionResolved, selectedSession]);
  const hasFilters = Boolean(filters.search)
    || Boolean(filters.cohortId)
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
    error={query.error ?? undefined}
    emptyMessage={hasFilters ? 'No sessions match your search and filters' : 'No sessions yet'}
    keyExtractor={session => session.id}
    selectedKey={selectedSessionId || null}
    scrollToSelected={Boolean(selectedSessionId)}
    onRowSelect={onSessionSelect}
    sorting={sorting}
    onSortingChange={next => onSortingChange(next as ListSort<SessionSortKey>)}
    columnWidths={columnWidths}
    onColumnWidthsChange={onColumnWidthsChange}
    hasNextPage={query.hasNextPage}
    loadingNextPage={query.loadingNextPage}
    onLoadNextPage={query.loadNextPage}
  />;
}
