import { useEffect } from 'react';
import Table from '../../../../../common/components/Table/Table';
import usePageErrorReporter, { type PageErrorChangeHandler } from '../../../../../common/components/PageErrorOverlay/usePageErrorReporter';
import type { TableColumnDef } from '../../../../../common/components/Table/Table.types';
import type { CohortSortKey, ProgramCohort } from '../../../../../common/types/cohort';
import type { ListSort } from '../../../../../common/types/pagination';
import useCohortTableData from './hooks/useCohortTableData';

interface CohortTableProps {
  queryKey: readonly unknown[];
  filters: { programId?: string; search?: string; status?: string } | null;
  columns: TableColumnDef<ProgramCohort>[];
  hiddenColumnKeys: string[];
  sorting: ListSort<CohortSortKey>;
  columnWidths: Record<string, number>;
  selectedKey: string | null;
  hasActiveQueryFilters: boolean;
  onRowSelect: (cohort: ProgramCohort | null) => void;
  onSortingChange: (sorting: ListSort<CohortSortKey>) => void;
  onColumnWidthsChange: (widths: Record<string, number>) => void;
  onErrorChange?: PageErrorChangeHandler;
}

export default function CohortTable(props: CohortTableProps) {
  const tableData = useCohortTableData(props.queryKey, props.filters, props.sorting);
  usePageErrorReporter(props.onErrorChange, tableData.error, { label: 'Retry', onClick: tableData.retry });

  useEffect(() => {
    if (!tableData.loading && props.selectedKey && !tableData.rows.some(cohort => cohort.id === props.selectedKey)) {
      props.onRowSelect(null);
    }
  }, [props.selectedKey, props.onRowSelect, tableData.loading, tableData.rows]);

  return <Table
    ariaLabel="Cohorts"
    columns={props.columns}
    hiddenColumnKeys={props.hiddenColumnKeys}
    data={tableData.rows}
    loading={tableData.loading}
    refreshing={tableData.refreshing}
    unavailable={tableData.error ? { title: 'Cohorts unavailable', onRetry: tableData.retry } : undefined}
    keyExtractor={cohort => cohort.id}
    selectedKey={props.selectedKey}
    onRowSelect={cohort => props.onRowSelect(cohort)}
    sorting={props.sorting}
    sortableColumns={['program', 'cohort', 'start', 'end', 'status']}
    onSortingChange={sorting => props.onSortingChange(sorting as ListSort<CohortSortKey>)}
    columnWidths={props.columnWidths}
    onColumnWidthsChange={props.onColumnWidthsChange}
    hasNextPage={tableData.hasNextPage}
    loadingNextPage={tableData.loadingNextPage}
    onLoadNextPage={tableData.loadNextPage}
    emptyMessage={props.hasActiveQueryFilters ? 'No cohorts match your search and filters' : 'No cohorts yet'}
  />;
}
