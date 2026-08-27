import { useEffect } from 'react';
import Table from '../../../../common/components/Table/Table';
import usePageErrorReporter, { type PageErrorChangeHandler } from '../../../../common/components/PageErrorOverlay/usePageErrorReporter';
import type { TableColumnDef } from '../../../../common/components/Table/Table.types';
import type { ListSort } from '../../../../common/types/pagination';
import { YOUTH_TABLE_KEYS, type YouthFilters, type YouthSortKey } from '../../../../common/types/youth';
import type { YouthProfile } from '../../types';
import useYouthTableData from './hooks/useYouthTableData';

interface YouthTableProps {
  columns: TableColumnDef<YouthProfile>[];
  filters: YouthFilters | null;
  hiddenColumnKeys: string[];
  sorting: ListSort<YouthSortKey>;
  columnWidths: Record<string, number>;
  selectedProfileId: string | null;
  hasActiveQueryFilters: boolean;
  onSelectedProfileResolved: (profile: YouthProfile | null) => void;
  onRowSelect: (profile: YouthProfile) => void;
  onSortingChange: (sorting: ListSort<YouthSortKey>) => void;
  onColumnWidthsChange: (widths: Record<string, number>) => void;
  onErrorChange?: PageErrorChangeHandler;
}

export default function YouthTable({
  columns, filters,
  hiddenColumnKeys, sorting, columnWidths, selectedProfileId, hasActiveQueryFilters,
  onSelectedProfileResolved, onRowSelect, onSortingChange, onColumnWidthsChange, onErrorChange,
}: YouthTableProps) {
  const tableData = useYouthTableData(filters, sorting);
  const selectedProfile = tableData.rows.find(profile => profile.id === selectedProfileId) ?? null;
  usePageErrorReporter(onErrorChange, tableData.error, { label: 'Retry', onClick: tableData.retry });

  useEffect(() => {
    if (!tableData.loading) onSelectedProfileResolved(selectedProfile);
  }, [onSelectedProfileResolved, selectedProfile, tableData.loading]);

  return <Table
    ariaLabel="Youth profiles"
    columns={columns}
    hiddenColumnKeys={hiddenColumnKeys}
    data={tableData.rows}
    loading={tableData.loading}
    refreshing={tableData.refreshing}
    unavailable={tableData.error ? { title: 'Youth profiles unavailable', onRetry: tableData.retry } : undefined}
    emptyMessage={hasActiveQueryFilters
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
    onLoadNextPage={tableData.loadNextPage}
  />;
}
