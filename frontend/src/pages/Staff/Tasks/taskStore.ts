import { createRecordStore } from '../../../query/createRecordStore';
import type { ListSort } from '../../../common/components/Table/Table.types';
import type { Task, TaskSortKey } from './types';

/**
 * Supplies the server-compatible value for the selected task table order.
 * @example getTaskSortValue(task, 'title') // lower-case title
 */
export function getTaskSortValue(task: Task, key: TaskSortKey) {
  return {
    firstName: task.assignee.firstName.toLowerCase(),
    lastName: task.assignee.lastName.toLowerCase(),
    title: task.title.toLowerCase(),
    category: task.category,
    program: task.program?.toLowerCase() ?? '',
    startDate: task.startDate,
    dueDate: task.dueDate,
    status: task.status,
  }[key];
}

export const taskStore = createRecordStore<Task>({
  queryKey: ['tasks', 'records'],
  listKey: ['tasks', 'table'],
  getSortValue: (task, queryKey) => {
    const sorting = queryKey[queryKey.length - 2] as ListSort<TaskSortKey>;
    return getTaskSortValue(task, sorting.key);
  },
});
