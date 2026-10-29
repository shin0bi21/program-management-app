import tableRefreshMessage from '../../../../../common/components/Table/tableRefreshMessage';
import Modal from '../../../../../common/components/Modal/Modal';
import Button from '../../../../../common/components/Button/Button';
import Table from '../../../../../common/components/Table/Table';
import usePageMessageReporter, { type PageMessageChangeHandler } from '../../../../../common/components/PageMessageOverlay/usePageMessageReporter';
import type { TableColumnDef } from '../../../../../common/components/Table/Table.types';
import type { ProgramCycle } from '../../../../../common/features/programming/cycles/types';
import useCycleTableData from './hooks/useCycleTableData';

interface CycleTableProps {
  columns: TableColumnDef<ProgramCycle>[];
  isOpen: boolean;
  enabled: boolean;
  onClose: () => void;
  onAdd: () => void;
  onMessageChange?: PageMessageChangeHandler;
}

export default function CycleTable({ columns, isOpen, enabled, onClose, onAdd, onMessageChange }: CycleTableProps) {
  const query = useCycleTableData(enabled);
  usePageMessageReporter(onMessageChange, query.error || query.nextPageError, {
    label: 'Retry', onClick: query.nextPageError ? query.retryNextPage : query.retry,
  }, tableRefreshMessage(query.refreshNotice));

  return <Modal isOpen={isOpen} title="Manage Cycles" maxWidth="900px" onClose={onClose}>
    <Button onClick={onAdd}>+ Add Cycle</Button>
    <Table
      ariaLabel="Cycles"
      columns={columns}
      data={query.rows}
      loading={query.loading}
      refreshing={query.refreshing}
      unavailable={query.error && !query.rows.length ? { title: 'Cycles unavailable', onRetry: query.retry } : undefined}
      hasNextPage={query.hasNextPage}
      loadingNextPage={query.loadingNextPage}
      nextPageUnavailable={query.nextPageError ? { onRetry: query.retryNextPage } : undefined}
      onLoadNextPage={query.loadNextPage}
      keyExtractor={cycle => cycle.id}
      emptyMessage="No cycles yet"
    />
  </Modal>;
}
