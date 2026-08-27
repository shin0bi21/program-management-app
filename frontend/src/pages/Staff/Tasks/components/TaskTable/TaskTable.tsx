import Table from '../../../../../common/components/Table/Table';
import usePageErrorReporter, { type PageErrorChangeHandler } from '../../../../../common/components/PageErrorOverlay/usePageErrorReporter';
import type { TableColumnDef } from '../../../../../common/components/Table/Table.types';
import type { Task, TaskCategory, TaskStatus } from '../../types';
import type { ListSort } from '../../../../../common/types/pagination';
import { TASK_TABLE_KEYS, type TaskSortKey } from '../../types';
import useTaskTableData from './hooks/useTaskTableData';

interface TaskTableProps {
  queryKey: readonly unknown[];
  columns: TableColumnDef<Task>[];
  hiddenColumnKeys: string[];
  staffIds: string[];
  programIds: string[];
  categories: TaskCategory[];
  statuses: TaskStatus[];
  search: string;
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
  queryKey, columns, hiddenColumnKeys, staffIds, programIds, categories, statuses, search, today, sorting, columnWidths,
  selectedTaskId, onTaskSelect, onSortingChange, onColumnWidthsChange, onErrorChange,
}: TaskTableProps) {
  const query = useTaskTableData(queryKey, { staffIds, programIds, categories, statuses, search }, sorting, today);
  usePageErrorReporter(onErrorChange, query.error, { label: 'Retry', onClick: query.retry });
  const hasFilters = staffIds.length > 0 || programIds.length > 0 || categories.length > 0 || statuses.length > 0;

  return <Table
    ariaLabel="Tasks"
    columns={columns}
    hiddenColumnKeys={hiddenColumnKeys}
    data={query.rows}
    loading={query.loading}
    refreshing={query.refreshing}
    unavailable={query.error ? { title: 'Tasks unavailable', onRetry: query.retry } : undefined}
    emptyMessage={search || hasFilters ? 'No tasks match these filters' : 'No tasks assigned'}
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
    onLoadNextPage={query.loadNextPage}
  />;
}
