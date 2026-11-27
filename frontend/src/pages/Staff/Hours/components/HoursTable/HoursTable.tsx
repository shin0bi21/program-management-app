import type { ReactElement } from 'react';
import tableRefreshMessage from '../../../../../common/components/Table/tableRefreshMessage';
import Table from '../../../../../common/components/Table/Table';
import usePageMessageReporter from '../../../../../common/components/PageMessageOverlay/usePageMessageReporter';
import type { TableColumnDef } from '../../../../../common/components/Table/Table.types';
import type { HoursFilters, Hours } from '../../types';
import type { ListSort } from '../../../../../common/components/Table/Table.types';
import { HOURS_TABLE_KEYS, type HoursSortKey } from '../../types';
import useHoursTableData from './hooks/useHoursTableData';

interface HoursTableProps {
  queryKey: readonly unknown[];
  columns: TableColumnDef<Hours>[];
  hiddenColumnKeys: string[];
  filters: HoursFilters;
  sorting: ListSort<HoursSortKey>;
  columnWidths: Record<string, number>;
  selectedRowId: string | null;
  onRowSelect: (row: Hours) => void;
  onSortingChange: (sorting: ListSort<HoursSortKey>) => void;
  onColumnWidthsChange: (widths: Record<string, number>) => void;
}

/**
 * Displays filtered Hours rows from the table query.
 * @example <HoursTable filters={filters} {...tableProps} />
 */
export default function HoursTable({
  queryKey, columns, hiddenColumnKeys, filters,
  sorting, columnWidths, selectedRowId, onRowSelect, onSortingChange,
  onColumnWidthsChange,
}: HoursTableProps): ReactElement {
  const query = useHoursTableData(queryKey, filters, sorting);
  usePageMessageReporter(undefined, query.error || query.nextPageError, { label: 'Retry', onClick: query.nextPageError ? query.retryNextPage : query.retry }, tableRefreshMessage(query.refreshNotice));

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
