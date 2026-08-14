import { TASKS_QUERY_KEY } from '../../../common/features/tasks/queryKeys';

export const TASK_LIST_QUERY_KEY = [...TASKS_QUERY_KEY, 'list'] as const;

export { TASKS_QUERY_KEY };
