import Table from '../../../../../common/components/Table/Table';
import type { TableColumnDef } from '../../../../../common/components/Table/Table.types';
import type { HoursCategory, HoursTableRow } from '../../../../../common/features/hours/types';
import type { ListSort } from '../../../../../common/types/pagination';
import { HOURS_TABLE_KEYS, type HoursEntryType, type HoursSortKey } from '../../types';
import useHoursTableData from './hooks/useHoursTableData';

interface HoursTableProps {
  queryKey: readonly unknown[];
  columns: TableColumnDef<HoursTableRow>[];
  hiddenColumnKeys: string[];
  staffIds: string[];
  categories: HoursCategory[];
  programIds: string[];
  types: HoursEntryType[];
  cycleId?: string;
  search: string;
  sorting: ListSort<HoursSortKey>;
  columnWidths: Record<string, number>;
  selectedRowId: string | null;
  onRowSelect: (row: HoursTableRow) => void;
  onSortingChange: (sorting: ListSort<HoursSortKey>) => void;
  onColumnWidthsChange: (widths: Record<string, number>) => void;
}

export default function HoursTable({
  queryKey, columns, hiddenColumnKeys, staffIds, categories, programIds, types, cycleId, search,
  sorting, columnWidths, selectedRowId, onRowSelect, onSortingChange,
  onColumnWidthsChange,
}: HoursTableProps) {
  const query = useHoursTableData(queryKey, { staffIds, categories, programIds, types, cycleId, search }, sorting);

  return <Table
    ariaLabel="Hours entries"
    columns={columns}
    hiddenColumnKeys={hiddenColumnKeys}
    data={query.rows}
    loading={query.loading}
    refreshing={query.refreshing}
    error={query.error || undefined}
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
