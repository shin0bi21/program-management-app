import Table, { type TableColumn } from '../../../../../common/components/Table/Table';
import type { Task, TaskCategory, TaskListStatus } from '../../../../../common/features/tasks/types';
import type { ListSort } from '../../../../../common/types/pagination';
import { TASK_TABLE_KEYS, type TaskSortKey } from '../../types';
import useTaskList from './hooks/useTaskList';

interface TaskTableViewProps {
  queryKey: readonly unknown[];
  columns: TableColumn<Task>[];
  hiddenColumnKeys: string[];
  staffIds: string[];
  programIds: string[];
  categories: TaskCategory[];
  statuses: TaskListStatus[];
  search: string;
  today: string;
  sorting: ListSort<TaskSortKey>;
  columnWidths: Record<string, number>;
  selectedTaskId: string | null;
  onTaskSelect: (task: Task) => void;
  onSortingChange: (sorting: ListSort<TaskSortKey>) => void;
  onColumnWidthsChange: (widths: Record<string, number>) => void;
}

export default function TaskTableView({
  queryKey, columns, hiddenColumnKeys, staffIds, programIds, categories, statuses, search, today, sorting, columnWidths,
  selectedTaskId, onTaskSelect, onSortingChange, onColumnWidthsChange,
}: TaskTableViewProps) {
  const query = useTaskList(queryKey, { staffIds, programIds, categories, statuses, search }, sorting, today);
  const hasFilters = staffIds.length > 0 || programIds.length > 0 || categories.length > 0 || statuses.length > 0;

  return <Table
    ariaLabel="Tasks"
    columns={columns}
    hiddenColumnKeys={hiddenColumnKeys}
    data={query.rows}
    loading={query.loading}
    refreshing={query.refreshing}
    error={query.error || undefined}
    emptyMessage={query.appliedSearch.trim() || hasFilters ? 'No tasks match these filters' : 'No tasks assigned'}
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
