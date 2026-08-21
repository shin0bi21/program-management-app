import Table from '../../../../../common/components/Table/Table';
import type { TableColumnDef } from '../../../../../common/components/Table/Table.types';
import { ACCOUNT_TABLE_KEYS, type Account, type AccountFilters, type AccountSortKey } from '../../../../../common/types/account';
import type { ListSort } from '../../../../../common/types/pagination';
import useUserTableData from './hooks/useUserTableData';

interface UserTableProps {
  queryKey: readonly unknown[];
  filters: AccountFilters | null;
  columns: TableColumnDef<Account>[];
  hiddenColumnKeys: string[];
  sorting: ListSort<AccountSortKey>;
  columnWidths: Record<string, number>;
  hasActiveQueryFilters: boolean;
  onSortingChange: (sorting: ListSort<AccountSortKey>) => void;
  onColumnWidthsChange: (widths: Record<string, number>) => void;
}

export default function UserTable(props: UserTableProps) {
  const tableData = useUserTableData(props.queryKey, props.filters, props.sorting);
  return <Table
    ariaLabel="Accounts"
    columns={props.columns}
    hiddenColumnKeys={props.hiddenColumnKeys}
    data={tableData.rows}
    loading={tableData.loading}
    refreshing={tableData.refreshing}
    error={tableData.error}
    emptyMessage={props.hasActiveQueryFilters ? 'No accounts match these filters' : 'No accounts found'}
    keyExtractor={account => account.id}
    sorting={props.sorting}
    sortableColumns={ACCOUNT_TABLE_KEYS}
    onSortingChange={sorting => props.onSortingChange(sorting as ListSort<AccountSortKey>)}
    columnWidths={props.columnWidths}
    onColumnWidthsChange={props.onColumnWidthsChange}
    hasNextPage={tableData.hasNextPage}
    loadingNextPage={tableData.loadingNextPage}
    onLoadNextPage={tableData.loadNextPage}
  />;
}
