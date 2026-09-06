import { useEffect } from 'react';
import Table from '../../../../../common/components/Table/Table';
import usePageErrorReporter, { type PageErrorChangeHandler } from '../../../../../common/components/PageErrorOverlay/usePageErrorReporter';
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
  onErrorChange?: PageErrorChangeHandler;
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
  onErrorChange,
}: CohortTableProps) {
  const tableData = useCohortTableData(queryKey, filters, sorting);
  const hasFilters = Boolean(filters?.programId || filters?.search || filters?.status);
  usePageErrorReporter(onErrorChange, tableData.error, { label: 'Retry', onClick: tableData.retry });

  useEffect(() => {
    if (!tableData.loading && selectedKey && !tableData.rows.some(cohort => cohort.id === selectedKey)) {
      onRowSelect(null);
    }
  }, [onRowSelect, selectedKey, tableData.loading, tableData.rows]);

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
    onLoadNextPage={tableData.loadNextPage}
    emptyMessage={hasFilters ? 'No cohorts match your search and filters' : 'No cohorts yet'}
  />;
}
