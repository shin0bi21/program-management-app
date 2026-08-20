import { COHORT_QUERY_KEY, SESSION_QUERY_KEY } from '../../../common/features/programming/queryKeys';

export const COHORT_OPTIONS_QUERY_KEY = [...COHORT_QUERY_KEY, 'options'] as const;

export { COHORT_QUERY_KEY, SESSION_QUERY_KEY };
