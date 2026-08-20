import Table, { type TableColumn } from '../../../../../common/components/Table/Table';
import type { HoursCategory } from '../../../../../common/features/hours/types';
import type { ListSort } from '../../../../../common/types/pagination';
import type { HoursEntryType, HoursListRow, HoursSortKey } from '../../types';
import useHoursList from './hooks/useHoursList';

interface HoursTableViewProps {
  queryKey: readonly unknown[];
  columns: TableColumn<HoursListRow>[];
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
  onRowSelect: (row: HoursListRow) => void;
  onSortingChange: (sorting: ListSort<HoursSortKey>) => void;
  onColumnWidthsChange: (widths: Record<string, number>) => void;
}

export default function HoursTableView({
  queryKey, columns, hiddenColumnKeys, staffIds, categories, programIds, types, cycleId, search,
  sorting, columnWidths, selectedRowId, onRowSelect, onSortingChange,
  onColumnWidthsChange,
}: HoursTableViewProps) {
  const query = useHoursList(queryKey, { staffIds, categories, programIds, types, cycleId, search }, sorting);
  const hasNonCycleFilters = staffIds.length > 0
    || categories.length > 0
    || programIds.length > 0
    || types.length > 0;

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
    onSortingChange={next => onSortingChange(next as ListSort<HoursSortKey>)}
    columnWidths={columnWidths}
    onColumnWidthsChange={onColumnWidthsChange}
    hasNextPage={query.hasNextPage}
    loadingNextPage={query.loadingNextPage}
    onLoadNextPage={query.loadNextPage}
    emptyMessage={query.appliedSearch.trim()
      ? 'No hours match your search'
      : hasNonCycleFilters
        ? 'No hours match these filters'
        : cycleId
          ? 'No hours for this cycle'
          : 'No hours found'}
  />;
}
