import { getSchools } from '../schools.api';
import type { School } from '../types';
import useListQuery from '../../../../../../../query/hooks/useListQuery';

export type { School };

export function useSchools() {
  const query = useListQuery<School>({
    queryKey: ['schools'],
    queryFn: ({ signal }) => getSchools({ signal }),
    errorMessage: 'Failed to load schools',
  });

  return {
    schools: query.rows,
    upsertSchool: query.upsert,
    removeSchool: query.remove,
    loading: query.loading,
    error: query.error,
    refetch: query.refetch,
  };
}
