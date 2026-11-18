import type { useProgramCycleAssignments } from '../../hooks/data/useProgramCycleAssignments';
import tableRefreshMessage from '../../../../../common/components/Table/tableRefreshMessage';
import Table from '../../../../../common/components/Table/Table';
import type { Program } from '../../types';
import usePageMessageReporter, { type PageMessageChangeHandler } from '../../../../../common/components/PageMessageOverlay/usePageMessageReporter';
import type { ProgramFilters } from '../../api/programs.api';
import useProgramTableData from './hooks/useProgramTableData';
import useProgramTable from './hooks/useProgramTable';

interface ProgramTableProps {
  assignments: ReturnType<typeof useProgramCycleAssignments>;
  queryKey: readonly unknown[];
  filters: ProgramFilters;
  canWrite: boolean;
  onEdit: (program: Program) => void;
  onManageCycles: (program: Program) => void;
  selectedProgramId?: string | null;
  onProgramSelect?: (program: Program) => void;
  onMessageChange?: PageMessageChangeHandler;
  onAssignmentsMessageChange?: PageMessageChangeHandler;
}

/**
 * Displays component-owned program rows with page-supplied assignment statuses.
 * @param props - Applied scope, selection, edit actions, and message reporter.
 * @example <ProgramTable {...tableProps} />
 */
export default function ProgramTable(props: ProgramTableProps) {
  const query = useProgramTableData(props.queryKey, props.filters);
  const { columns } = useProgramTable(props.onEdit, props.onManageCycles, props.canWrite, props.assignments);
  usePageMessageReporter(props.onMessageChange, query.error || query.nextPageError, {
    label: 'Retry', onClick: query.nextPageError ? query.retryNextPage : query.retry,
  }, tableRefreshMessage(query.refreshNotice));
  usePageMessageReporter(props.onAssignmentsMessageChange, props.assignments.error, {
    label: 'Retry', onClick: props.assignments.refresh,
  });

  return <Table
    ariaLabel="Programs"
    columns={columns}
    data={query.rows}
    loading={query.loading}
    refreshing={query.refreshing}
    unavailable={query.error && !query.rows.length ? { title: 'Programs unavailable', onRetry: query.retry } : undefined}
    keyExtractor={program => program.id}
    selectedKey={props.selectedProgramId}
    onRowSelect={props.onProgramSelect}
    emptyMessage="No programs yet"
    hasNextPage={query.hasNextPage}
    loadingNextPage={query.loadingNextPage}
    nextPageUnavailable={query.nextPageError ? { onRetry: query.retryNextPage } : undefined}
    onLoadNextPage={query.loadNextPage}
  />;
}
