import { TABLE_PAGE_SIZE } from '../../../../../../query/types';
import { getTasksTableData, type TasksFilters } from '../../../tasks.api';
import { useMemo } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import type { RecordListIndex } from '../../../../../../query/createRecordStore';
import { taskStore, getTaskSortValue } from '../../../taskStore';
import type { ListSort } from '../../../../../../common/components/Table/Table.types';
import useInfiniteListQuery from '../../../../../../query/hooks/useInfiniteListQuery';
import type { TaskSortKey } from '../../../types';

/**
 * Loads task page membership and resolves IDs through the shared record owner.
 * @example useTaskTableData(['tasks', 'table'], filters, sorting, today)
 */
export default function useTaskTableData(
  queryKey: readonly unknown[],
  filters: TasksFilters,
  sorting: ListSort<TaskSortKey>,
  today: string,
) {
  const client = useQueryClient();
  const records = taskStore.useRecords();
  const query = useInfiniteListQuery<RecordListIndex>({
    ordering: { direction: sorting.direction, getValue: index => index.sortValue },
    queryKey: [...queryKey, filters, sorting, today],
    queryFn: async ({ signal, pageParam }) => {
      const read = taskStore.beginRead(client);
      const page = await getTasksTableData(
        filters, { signal }, { ...sorting, cursor: pageParam ?? undefined, limit: TABLE_PAGE_SIZE },
      );
      const rows = taskStore.finishRead(client, read, page.rows, signal);
      return {
        nextCursor: page.nextCursor,
        rows: rows.map(task => ({ id: task.id, sortValue: getTaskSortValue(task, sorting.key) })),
      };
    },
    errorMessage: 'Unable to load tasks.',
  });
  const rows = useMemo(() => query.rows.flatMap(({ id }) => records[id] ? [records[id]] : []), [query.rows, records]);

  return { ...query, rows };
}
