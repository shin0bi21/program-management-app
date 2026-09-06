import Table from '../../../../../common/components/Table/Table';
import usePageErrorReporter, { type PageErrorChangeHandler } from '../../../../../common/components/PageErrorOverlay/usePageErrorReporter';
import type { TableColumnDef } from '../../../../../common/components/Table/Table.types';
import type { HoursFilters, HoursTableRow } from '../../types';
import type { ListSort } from '../../../../../common/components/Table/Table.types';
import { HOURS_TABLE_KEYS, type HoursSortKey } from '../../types';
import useHoursTableData from './hooks/useHoursTableData';

interface HoursTableProps {
  queryKey: readonly unknown[];
  columns: TableColumnDef<HoursTableRow>[];
  hiddenColumnKeys: string[];
  filters: HoursFilters;
  sorting: ListSort<HoursSortKey>;
  columnWidths: Record<string, number>;
  selectedRowId: string | null;
  onRowSelect: (row: HoursTableRow) => void;
  onSortingChange: (sorting: ListSort<HoursSortKey>) => void;
  onColumnWidthsChange: (widths: Record<string, number>) => void;
  onErrorChange?: PageErrorChangeHandler;
}

export default function HoursTable({
  queryKey, columns, hiddenColumnKeys, filters,
  sorting, columnWidths, selectedRowId, onRowSelect, onSortingChange,
  onColumnWidthsChange, onErrorChange,
}: HoursTableProps) {
  const query = useHoursTableData(queryKey, filters, sorting);
  usePageErrorReporter(onErrorChange, query.error, { label: 'Retry', onClick: query.retry });

  return <Table
    ariaLabel="Hours entries"
    columns={columns}
    hiddenColumnKeys={hiddenColumnKeys}
    data={query.rows}
    loading={query.loading}
    refreshing={query.refreshing}
    unavailable={query.error ? { title: 'Hours unavailable', onRetry: query.retry } : undefined}
    keyExtractor={row => row.id}
    selectedKey={selectedRowId}
    onRowSelect={onRowSelect}
    sorting={sorting}
    sortableColumns={HOURS_TABLE_KEYS}
    onSortingChange={next => onSortingChange(next as ListSort<HoursSortKey>)}
    columnWidths={columnWidths}
    onColumnWidthsChange={onColumnWidthsChange}
    hasNextPage={query.hasNextPage}
    loadingNextPage={query.loadingNextPage}
    onLoadNextPage={query.loadNextPage}
    emptyMessage="No hours found"
  />;
}
