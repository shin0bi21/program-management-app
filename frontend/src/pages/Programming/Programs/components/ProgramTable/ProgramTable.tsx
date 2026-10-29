import tableRefreshMessage from '../../../../../common/components/Table/tableRefreshMessage';
import Table from '../../../../../common/components/Table/Table';
import type { TableColumnDef } from '../../../../../common/components/Table/Table.types';
import type { Program } from '../../../../../common/features/programs/types';
import usePageMessageReporter, { type PageMessageChangeHandler } from '../../../../../common/components/PageMessageOverlay/usePageMessageReporter';
import type { ProgramFilters } from '../../api/programs.api';
import useProgramTableData from './hooks/useProgramTableData';

interface ProgramTableProps {
  queryKey: readonly unknown[];
  filters: ProgramFilters;
  columns: TableColumnDef<Program>[];
  selectedProgramId?: string | null;
  onProgramSelect?: (program: Program) => void;
  onMessageChange?: PageMessageChangeHandler;
}

export default function ProgramTable(props: ProgramTableProps) {
  const query = useProgramTableData(props.queryKey, props.filters);
  usePageMessageReporter(props.onMessageChange, query.error || query.nextPageError, {
    label: 'Retry', onClick: query.nextPageError ? query.retryNextPage : query.retry,
  }, tableRefreshMessage(query.refreshNotice));

  return <Table
    ariaLabel="Programs"
    columns={props.columns}
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
