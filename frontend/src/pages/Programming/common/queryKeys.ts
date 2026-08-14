import { COHORT_QUERY_KEY, SESSION_QUERY_KEY } from '../../../common/features/programming/queryKeys';

export const COHORT_TABLE_QUERY_KEY = [...COHORT_QUERY_KEY, 'table'] as const;
export const COHORT_OPTIONS_QUERY_KEY = [...COHORT_QUERY_KEY, 'options'] as const;

export const SESSION_LIST_QUERY_KEY = [...SESSION_QUERY_KEY, 'list'] as const;
export const SESSION_CALENDAR_QUERY_KEY = [...SESSION_QUERY_KEY, 'calendar'] as const;

export { COHORT_QUERY_KEY, SESSION_QUERY_KEY };
