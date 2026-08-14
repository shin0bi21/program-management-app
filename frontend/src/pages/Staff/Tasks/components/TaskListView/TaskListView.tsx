import Table, { type TableColumn } from '../../../../../common/components/Table/Table';
import type { Task, TaskCategory, TaskStatus } from '../../../../../common/features/tasks/types';
import type { ListSort } from '../../../../../common/types/pagination';
import type { TaskSortKey } from '../../taskViewTypes';
import useTaskList from './hooks/useTaskList';

interface TaskListViewProps {
  columns: TableColumn<Task>[];
  hiddenColumnKeys: string[];
  staffIds: string[];
  programIds: string[];
  categories: TaskCategory[];
  statuses: TaskStatus[];
  search: string;
  sorting: ListSort<TaskSortKey>;
  columnWidths: Record<string, number>;
  selectedTaskId: string | null;
  onTaskSelect: (task: Task) => void;
  onSortingChange: (sorting: ListSort<TaskSortKey>) => void;
  onColumnWidthsChange: (widths: Record<string, number>) => void;
}

export default function TaskListView({
  columns, hiddenColumnKeys, staffIds, programIds, categories, statuses, search, sorting, columnWidths,
  selectedTaskId, onTaskSelect, onSortingChange, onColumnWidthsChange,
}: TaskListViewProps) {
  const query = useTaskList({ staffIds, programIds, categories, statuses, search }, sorting, true);
  const hasFilters = staffIds.length > 0 || programIds.length > 0 || categories.length > 0 || statuses.length > 0;

  return <Table
    ariaLabel="Tasks"
    columns={columns}
    hiddenColumnKeys={hiddenColumnKeys}
    data={query.rows}
    loading={query.loading}
    refreshing={query.refreshing}
    error={query.error || undefined}
    emptyMessage={search.trim() || hasFilters ? 'No tasks match these filters' : 'No tasks assigned'}
    keyExtractor={task => task.id}
    selectedKey={selectedTaskId}
    onRowSelect={onTaskSelect}
    sorting={sorting}
    onSortingChange={next => onSortingChange(next as ListSort<TaskSortKey>)}
    columnWidths={columnWidths}
    onColumnWidthsChange={onColumnWidthsChange}
    hasNextPage={query.hasNextPage}
    loadingNextPage={query.loadingNextPage}
    onLoadNextPage={query.loadNextPage}
  />;
}
