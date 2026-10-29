import tableRefreshMessage from '../../../../../common/components/Table/tableRefreshMessage';
import Table from '../../../../../common/components/Table/Table';
import usePageMessageReporter, { type PageMessageChangeHandler } from '../../../../../common/components/PageMessageOverlay/usePageMessageReporter';
import type { TableColumnDef } from '../../../../../common/components/Table/Table.types';
import { USER_TABLE_KEYS, type User, type UserFilters, type UserSortKey } from '../../types';
import type { ListSort } from '../../../../../common/components/Table/Table.types';
import useUserTableData from './hooks/useUserTableData';

interface UserTableProps {
  queryKey: readonly unknown[];
  filters: UserFilters | null;
  columns: TableColumnDef<User>[];
  hiddenColumnKeys: string[];
  sorting: ListSort<UserSortKey>;
  columnWidths: Record<string, number>;
  onSortingChange: (sorting: ListSort<UserSortKey>) => void;
  onColumnWidthsChange: (widths: Record<string, number>) => void;
  onMessageChange?: PageMessageChangeHandler;
}

export default function UserTable(props: UserTableProps) {
  const tableData = useUserTableData(props.queryKey, props.filters, props.sorting);
  const hasFilters = Boolean(props.filters?.search || props.filters?.roles?.length || props.filters?.statuses?.length);
  usePageMessageReporter(props.onMessageChange, tableData.error || tableData.nextPageError, { label: 'Retry', onClick: tableData.nextPageError ? tableData.retryNextPage : tableData.retry }, tableRefreshMessage(tableData.refreshNotice));
  return <Table
    ariaLabel="Accounts"
    columns={props.columns}
    hiddenColumnKeys={props.hiddenColumnKeys}
    data={tableData.rows}
    loading={tableData.loading}
    refreshing={tableData.refreshing}
    unavailable={tableData.error && !tableData.rows.length ? { title: 'Accounts unavailable', onRetry: tableData.retry } : undefined}
    emptyMessage={hasFilters ? 'No accounts match these filters' : 'No accounts found'}
    keyExtractor={account => account.id}
    sorting={props.sorting}
    sortableColumns={USER_TABLE_KEYS}
    onSortingChange={sorting => props.onSortingChange(sorting as ListSort<UserSortKey>)}
    columnWidths={props.columnWidths}
    onColumnWidthsChange={props.onColumnWidthsChange}
    hasNextPage={tableData.hasNextPage}
    loadingNextPage={tableData.loadingNextPage}
    nextPageUnavailable={tableData.nextPageError ? { onRetry: tableData.retryNextPage } : undefined}
    onLoadNextPage={tableData.loadNextPage}
  />;
}
