import tableRefreshMessage from '../../../../../common/components/Table/tableRefreshMessage';
import Table from '../../../../../common/components/Table/Table';
import usePageMessageReporter, { type PageMessageChangeHandler } from '../../../../../common/components/PageMessageOverlay/usePageMessageReporter';
import type { TableColumnDef } from '../../../../../common/components/Table/Table.types';
import type { CohortListFilters, CohortSortKey, ProgramCohort } from '../../types';
import type { ListSort } from '../../../../../common/components/Table/Table.types';
import useCohortTableData from './hooks/useCohortTableData';

interface CohortTableProps {
  queryKey: readonly unknown[];
  filters: CohortListFilters | null;
  columns: TableColumnDef<ProgramCohort>[];
  hiddenColumnKeys: string[];
  sorting: ListSort<CohortSortKey>;
  columnWidths: Record<string, number>;
  selectedKey: string | null;
  onRowSelect: (cohort: ProgramCohort | null) => void;
  onSortingChange: (sorting: ListSort<CohortSortKey>) => void;
  onColumnWidthsChange: (widths: Record<string, number>) => void;
  onMessageChange?: PageMessageChangeHandler;
}

export default function CohortTable({
  queryKey,
  filters,
  columns,
  hiddenColumnKeys,
  sorting,
  columnWidths,
  selectedKey,
  onRowSelect,
  onSortingChange,
  onColumnWidthsChange,
  onMessageChange,
}: CohortTableProps) {
  const tableData = useCohortTableData(queryKey, filters, sorting);
  const hasFilters = Boolean(filters?.programId || filters?.search || filters?.status);
  usePageMessageReporter(onMessageChange, tableData.error || tableData.nextPageError, { label: 'Retry', onClick: tableData.nextPageError ? tableData.retryNextPage : tableData.retry }, tableRefreshMessage(tableData.refreshNotice));



  return <Table
    ariaLabel="Cohorts"
    columns={columns}
    hiddenColumnKeys={hiddenColumnKeys}
    data={tableData.rows}
    loading={tableData.loading}
    refreshing={tableData.refreshing}
    unavailable={tableData.error ? { title: 'Cohorts unavailable', onRetry: tableData.retry } : undefined}
    keyExtractor={cohort => cohort.id}
    selectedKey={selectedKey}
    onRowSelect={cohort => onRowSelect(cohort)}
    sorting={sorting}
    sortableColumns={['program', 'cohort', 'start', 'end', 'status']}
    onSortingChange={nextSorting => onSortingChange(nextSorting as ListSort<CohortSortKey>)}
    columnWidths={columnWidths}
    onColumnWidthsChange={onColumnWidthsChange}
    hasNextPage={tableData.hasNextPage}
    loadingNextPage={tableData.loadingNextPage}
    nextPageUnavailable={tableData.nextPageError ? { onRetry: tableData.retryNextPage } : undefined}
    onLoadNextPage={tableData.loadNextPage}
    emptyMessage={hasFilters ? 'No cohorts match your search and filters' : 'No cohorts yet'}
  />;
}
