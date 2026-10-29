import Table from '../../../../../common/components/Table/Table';
import usePageErrorReporter, { type PageErrorChangeHandler } from '../../../../../common/components/PageErrorOverlay/usePageErrorReporter';
import type { TableColumnDef } from '../../../../../common/components/Table/Table.types';
import type { Task, TasksFilters } from '../../types';
import type { ListSort } from '../../../../../common/components/Table/Table.types';
import { TASK_TABLE_KEYS, type TaskSortKey } from '../../types';
import useTaskTableData from './hooks/useTaskTableData';

interface TaskTableProps {
  queryKey: readonly unknown[];
  columns: TableColumnDef<Task>[];
  hiddenColumnKeys: string[];
  filters: TasksFilters;
  today: string;
  sorting: ListSort<TaskSortKey>;
  columnWidths: Record<string, number>;
  selectedTaskId: string | null;
  onTaskSelect: (task: Task) => void;
  onSortingChange: (sorting: ListSort<TaskSortKey>) => void;
  onColumnWidthsChange: (widths: Record<string, number>) => void;
  onErrorChange?: PageErrorChangeHandler;
}

export default function TaskTable({
  queryKey, columns, hiddenColumnKeys, filters, today, sorting, columnWidths,
  selectedTaskId, onTaskSelect, onSortingChange, onColumnWidthsChange, onErrorChange,
}: TaskTableProps) {
  const query = useTaskTableData(queryKey, filters, sorting, today);
  usePageErrorReporter(onErrorChange, query.error || query.nextPageError, { label: 'Retry', onClick: query.nextPageError ? query.retryNextPage : query.retry });
  const hasFilters = filters.staffIds.length > 0
    || filters.programIds.length > 0
    || filters.categories.length > 0
    || filters.statuses.length > 0;

  return <Table
    ariaLabel="Tasks"
    columns={columns}
    hiddenColumnKeys={hiddenColumnKeys}
    data={query.rows}
    loading={query.loading}
    refreshing={query.refreshing}
    unavailable={query.error ? { title: 'Tasks unavailable', onRetry: query.retry } : undefined}
    emptyMessage={filters.search || hasFilters ? 'No tasks match these filters' : 'No tasks assigned'}
    keyExtractor={task => task.id}
    selectedKey={selectedTaskId}
    onRowSelect={onTaskSelect}
    sorting={sorting}
    sortableColumns={TASK_TABLE_KEYS}
    onSortingChange={next => onSortingChange(next as ListSort<TaskSortKey>)}
    columnWidths={columnWidths}
    onColumnWidthsChange={onColumnWidthsChange}
    hasNextPage={query.hasNextPage}
    loadingNextPage={query.loadingNextPage}
    nextPageUnavailable={query.nextPageError ? { onRetry: query.retryNextPage } : undefined}
    onLoadNextPage={query.loadNextPage}
  />;
}
