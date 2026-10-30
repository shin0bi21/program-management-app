import tableRefreshMessage from '../../../../common/components/Table/tableRefreshMessage';
import { useEffect } from 'react';
import Table from '../../../../common/components/Table/Table';
import usePageMessageReporter, { type PageMessageChangeHandler } from '../../../../common/components/PageMessageOverlay/usePageMessageReporter';
import type { TableColumnDef } from '../../../../common/components/Table/Table.types';
import type { ListSort } from '../../../../common/components/Table/Table.types';
import { YOUTH_TABLE_KEYS, type YouthFilters, type YouthSortKey } from '../../types';
import type { YouthProfile } from '../../types';
import useYouthTableData from './hooks/useYouthTableData';

interface YouthTableProps {
  columns: TableColumnDef<YouthProfile>[];
  filters: YouthFilters | null;
  hiddenColumnKeys: string[];
  sorting: ListSort<YouthSortKey>;
  columnWidths: Record<string, number>;
  selectedProfileId: string | null;
  onSelectedProfileResolved: (profile: YouthProfile | null) => void;
  onRowSelect: (profile: YouthProfile) => void;
  onSortingChange: (sorting: ListSort<YouthSortKey>) => void;
  onColumnWidthsChange: (widths: Record<string, number>) => void;
  onMessageChange?: PageMessageChangeHandler;
}

export default function YouthTable({
  columns, filters,
  hiddenColumnKeys, sorting, columnWidths, selectedProfileId,
  onSelectedProfileResolved, onRowSelect, onSortingChange, onColumnWidthsChange, onMessageChange,
}: YouthTableProps) {
  const tableData = useYouthTableData(filters, sorting);
  const selectedProfile = tableData.rows.find(profile => profile.id === selectedProfileId) ?? null;
  const hasFilters = Boolean(
    filters?.search || filters?.programIds?.length || filters?.cycleIds?.length,
  );
  usePageMessageReporter(onMessageChange, tableData.error || tableData.nextPageError, { label: 'Retry', onClick: tableData.nextPageError ? tableData.retryNextPage : tableData.retry }, tableRefreshMessage(tableData.refreshNotice));

  useEffect(() => {
    if (!tableData.loading) onSelectedProfileResolved(selectedProfile);
  }, [onSelectedProfileResolved, selectedProfile, tableData.loading]);

  return <Table
    enableColumnResizing
    ariaLabel="Youth profiles"
    columns={columns}
    hiddenColumnKeys={hiddenColumnKeys}
    data={tableData.rows}
    loading={tableData.loading}
    refreshing={tableData.refreshing}
    unavailable={tableData.error && !tableData.rows.length ? { title: 'Youth profiles unavailable', onRetry: tableData.retry } : undefined}
    emptyMessage={hasFilters
      ? 'No youth profiles match these filters'
      : 'No youth profiles found'}
    keyExtractor={profile => profile.id}
    selectedKey={selectedProfileId}
    onRowSelect={onRowSelect}
    sorting={sorting}
    sortableColumns={YOUTH_TABLE_KEYS}
    onSortingChange={next => onSortingChange(next as ListSort<YouthSortKey>)}
    columnWidths={columnWidths}
    onColumnWidthsChange={onColumnWidthsChange}
    hasNextPage={tableData.hasNextPage}
    loadingNextPage={tableData.loadingNextPage}
    nextPageUnavailable={tableData.nextPageError ? { onRetry: tableData.retryNextPage } : undefined}
    onLoadNextPage={tableData.loadNextPage}
  />;
}
