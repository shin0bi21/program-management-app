import tableRefreshMessage from '../../../../../common/components/Table/tableRefreshMessage';
import Table from '../../../../../common/components/Table/Table';
import usePageMessageReporter, { type PageMessageChangeHandler } from '../../../../../common/components/PageMessageOverlay/usePageMessageReporter';
import type { TableColumnDef } from '../../../../../common/components/Table/Table.types';
import type { HoursFilters, HoursItem } from '../../types';
import type { ListSort } from '../../../../../common/components/Table/Table.types';
import { HOURS_TABLE_KEYS, type HoursSortKey } from '../../types';
import useHoursTableData from './hooks/useHoursTableData';

interface HoursTableProps {
  records: Readonly<Record<string, HoursItem>>;
  queryKey: readonly unknown[];
  columns: TableColumnDef<HoursItem>[];
  hiddenColumnKeys: string[];
  filters: HoursFilters;
  sorting: ListSort<HoursSortKey>;
  columnWidths: Record<string, number>;
  selectedRowId: string | null;
  onRowSelect: (row: HoursItem) => void;
  onSortingChange: (sorting: ListSort<HoursSortKey>) => void;
  onColumnWidthsChange: (widths: Record<string, number>) => void;
  onMessageChange?: PageMessageChangeHandler;
}

/**
 * Displays filtered Hours records resolved from their shared owner.
 * @example <HoursTable filters={filters} {...tableProps} />
 */
export default function HoursTable({
  records, queryKey, columns, hiddenColumnKeys, filters,
  sorting, columnWidths, selectedRowId, onRowSelect, onSortingChange,
  onColumnWidthsChange, onMessageChange,
}: HoursTableProps) {
  const query = useHoursTableData(queryKey, filters, sorting, records);
  usePageMessageReporter(onMessageChange, query.error || query.nextPageError, { label: 'Retry', onClick: query.nextPageError ? query.retryNextPage : query.retry }, tableRefreshMessage(query.refreshNotice));

  return <Table
    enableColumnResizing
    ariaLabel="Hours entries"
    columns={columns}
    hiddenColumnKeys={hiddenColumnKeys}
    data={query.rows}
    loading={query.loading}
    refreshing={query.refreshing}
    unavailable={query.error && !query.rows.length ? { title: 'Hours unavailable', onRetry: query.retry } : undefined}
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
    nextPageUnavailable={query.nextPageError ? { onRetry: query.retryNextPage } : undefined}
    onLoadNextPage={query.loadNextPage}
    emptyMessage="No hours found"
  />;
}
