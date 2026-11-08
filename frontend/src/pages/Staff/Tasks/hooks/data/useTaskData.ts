import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';

import { useCycleReferences, useProgramReferences, useStaffReferences } from '../../../../../common/features/referenceData/hooks/useReferenceData';
import { getTaskReferenceData } from '../../tasks.api';
import { createRecordStore } from '../../../../../query/createRecordStore';
import type { ListSort } from '../../../../../common/components/Table/Table.types';
import type { Task, TaskSortKey } from '../../types';

/**
 * Supplies the server-compatible value for the selected task table order.
 * @param task - Complete saved task whose fields match the server's table order.
 * @param key - Selected table column.
 * @example getTaskSortValue(task, 'title') // lower-case title
 */
export function getTaskSortValue(task: Task, key: TaskSortKey) {
  return {
    firstName: task.firstName.toLowerCase(),
    lastName: task.lastName.toLowerCase(),
    title: task.title.toLowerCase(),
    category: task.category,
    program: task.program?.toLowerCase() ?? '',
    startDate: task.startDate,
    dueDate: task.dueDate,
    status: task.status,
  }[key];
}

export const taskData = createRecordStore<Task>({
  queryKey: ['tasks', 'records'],
  listKey: ['tasks', 'table'],
  getSortValue: (task, queryKey) => {
    const sorting = queryKey[queryKey.length - 2] as ListSort<TaskSortKey>;
    return getTaskSortValue(task, sorting.key);
  },
});

/**
 * Supplies the page's current saved tasks and shared staff, program, cycle, and task choices.
 * @param referenceDataQueryKey - Cache key for task categories and lifecycle statuses.
 * @example const { records, resources, cycles } = useTaskData(['task-reference-data'])
 */
export default function useTaskData(referenceDataQueryKey: readonly unknown[]) {
  const records = taskData.useRecords();
  const query = useQuery({
    queryKey: referenceDataQueryKey,
    queryFn: ({ signal }) => getTaskReferenceData({ signal }),
  });

  const cyclesQuery = useCycleReferences();
  const programsQuery = useProgramReferences();
  const staffQuery = useStaffReferences('tasks');
  const resources = staffQuery.rows;

  const writableResources = useMemo(
    () => resources?.filter(resource => resource.writable) ?? [],
    [resources],
  );

  return {
    records,
    cycles: cyclesQuery.rows,
    cyclesLoading: cyclesQuery.loading,
    cyclesError: cyclesQuery.error,
    referenceData: query.data,
    referenceDataLoading: query.isLoading,
    referenceDataError: query.error,
    resources,
    resourcesLoading: staffQuery.loading,
    resourcesError: staffQuery.error,
    programs: programsQuery.rows,
    programsLoading: programsQuery.loading,
    programsError: programsQuery.error,
    writableResources,
  };
}
