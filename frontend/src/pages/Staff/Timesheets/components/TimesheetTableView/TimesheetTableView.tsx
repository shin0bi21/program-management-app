import Table, { type TableColumn } from '../../../../../common/components/Table/Table';
import type { TimeEntryCategory } from '../../../../../common/features/timeEntries/types';
import type { ListSort } from '../../../../../common/types/pagination';
import type { TimesheetEntryType, TimesheetListRow, TimesheetSortKey } from '../../types';
import useTimesheetList from './hooks/useTimesheetList';

interface TimesheetTableViewProps {
  queryKey: readonly unknown[];
  columns: TableColumn<TimesheetListRow>[];
  hiddenColumnKeys: string[];
  staffIds: string[];
  categories: TimeEntryCategory[];
  programIds: string[];
  types: TimesheetEntryType[];
  cycleId?: string;
  search: string;
  sorting: ListSort<TimesheetSortKey>;
  columnWidths: Record<string, number>;
  selectedRowId: string | null;
  onRowSelect: (row: TimesheetListRow) => void;
  onSortingChange: (sorting: ListSort<TimesheetSortKey>) => void;
  onColumnWidthsChange: (widths: Record<string, number>) => void;
}

export default function TimesheetTableView({
  queryKey, columns, hiddenColumnKeys, staffIds, categories, programIds, types, cycleId, search,
  sorting, columnWidths, selectedRowId, onRowSelect, onSortingChange,
  onColumnWidthsChange,
}: TimesheetTableViewProps) {
  const query = useTimesheetList(queryKey, { staffIds, categories, programIds, types, cycleId, search }, sorting);
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
    onSortingChange={next => onSortingChange(next as ListSort<TimesheetSortKey>)}
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
