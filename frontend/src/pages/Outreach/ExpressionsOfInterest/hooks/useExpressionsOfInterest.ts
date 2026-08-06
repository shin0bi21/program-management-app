import useListQuery from '../../../../common/hooks/useListQuery';
import { getExpressionsOfInterest } from '../api/expressionsOfInterest.api';
import type { ExpressionOfInterest, ExpressionOfInterestFilters } from '../types';

export function useExpressionsOfInterest(filters: ExpressionOfInterestFilters | null) {
  const query = useListQuery<ExpressionOfInterest>({
    queryKey: ['expressions-of-interest', filters],
    queryFn: ({ signal }) => getExpressionsOfInterest(filters ?? {}, { signal }),
    errorMessage: 'Failed to load expressions of interest',
    enabled: filters !== null,
  });

  return {
    submissions: query.rows,
    upsertSubmission: query.upsert,
    loading: query.loading,
    error: query.error,
  };
}
