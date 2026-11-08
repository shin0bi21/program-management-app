import tableRefreshMessage from '../../../../../common/components/Table/tableRefreshMessage';
import Table from '../../../../../common/components/Table/Table';
import type { Program } from '../../../../../common/features/programs/types';
import usePageMessageReporter, { type PageMessageChangeHandler } from '../../../../../common/components/PageMessageOverlay/usePageMessageReporter';
import type { ProgramFilters } from '../../api/programs.api';
import useProgramTableData from './hooks/useProgramTableData';
import useProgramTable from './hooks/useProgramTable';

interface ProgramTableProps {
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
 * Displays programs with component-owned rows and assignment statuses.
 * @param props - Applied scope, selection, edit actions, and message reporter.
 * @example <ProgramTable {...tableProps} />
 */
export default function ProgramTable(props: ProgramTableProps) {
  const query = useProgramTableData(props.queryKey, props.filters);
  const { columns } = useProgramTable(props.onEdit, props.onManageCycles, props.canWrite, query.assignments);
  usePageMessageReporter(props.onMessageChange, query.error || query.nextPageError, {
    label: 'Retry', onClick: query.nextPageError ? query.retryNextPage : query.retry,
  }, tableRefreshMessage(query.refreshNotice));
  usePageMessageReporter(props.onAssignmentsMessageChange, query.assignments.error, {
    label: 'Retry', onClick: query.assignments.refresh,
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
